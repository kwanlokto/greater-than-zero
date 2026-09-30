import { createTestDatabase } from './test-database';
import { clockAt, granola, yogurt } from './test-helpers';
import { createTracker, problemWithFoodItem, type FoodItemValues } from './tracker';

describe('Meals', () => {
  it.each([
    ['03:59', 'Snack'],
    ['04:00', 'Breakfast'],
    ['10:59', 'Breakfast'],
    ['11:00', 'Lunch'],
    ['14:59', 'Lunch'],
    ['15:00', 'Snack'],
    ['16:59', 'Snack'],
    ['17:00', 'Dinner'],
    ['21:59', 'Dinner'],
    ['22:00', 'Snack'],
  ])('added at %s are named %s, and eaten then', async (time, name) => {
    const clock = clockAt(`2026-09-29T${time}:00`);
    const tracker = createTracker(createTestDatabase(), clock);

    const meal = await tracker.createMeal();

    expect(await tracker.getMeal(meal.id)).toMatchObject({
      name,
      eatenAt: clock.now(),
      localDate: '2026-09-29',
    });
  });

  it("are grouped by the phone's local date they were added on, in the order eaten", async () => {
    const clock = clockAt('2026-09-28T23:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.createMeal();
    clock.setTime('2026-09-29T08:00:00');
    const breakfast = await tracker.createMeal();
    clock.setTime('2026-09-29T07:30:00');
    const coffee = await tracker.createMeal();
    clock.setTime('2026-09-30T00:15:00');
    await tracker.createMeal();

    const meals = await tracker.getMeals('2026-09-29');

    expect(meals.map(meal => meal.id)).toEqual([coffee.id, breakfast.id]);
    expect((await tracker.getMeals('2026-09-28')).map(meal => meal.name)).toEqual(['Snack']);
  });

  it('can be renamed, leaving their time as it was', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    const meal = await tracker.createMeal();

    await tracker.renameMeal(meal.id, ' Second breakfast ');
    await expect(tracker.renameMeal(meal.id, ' ')).rejects.toThrow('A Meal needs a name');

    expect(await tracker.getMeal(meal.id)).toMatchObject({
      name: 'Second breakfast',
      eatenAt: new Date('2026-09-29T08:00:00'),
    });
  });

  it('can be moved to another time of day, staying on their day, in the order eaten', async () => {
    const clock = clockAt('2026-09-29T08:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const breakfast = await tracker.createMeal();
    clock.setTime('2026-09-29T12:30:00');
    const lunch = await tracker.createMeal();
    clock.setTime('2026-09-30T09:00:00');

    await tracker.setMealTime(lunch.id, { hours: 7, minutes: 15 });

    const meals = await tracker.getMeals('2026-09-29');
    expect(meals.map(({ id, eatenAt }) => [id, eatenAt])).toEqual([
      [lunch.id, new Date('2026-09-29T07:15:00')],
      [breakfast.id, new Date('2026-09-29T08:00:00')],
    ]);
  });

  it.each([
    { hours: 24, minutes: 0 },
    { hours: 7, minutes: 60 },
    { hours: 7.5, minutes: 0 },
  ])('only move to a time of day there is, not %j', async time => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    const meal = await tracker.createMeal();

    await expect(tracker.setMealTime(meal.id, time)).rejects.toThrow(
      'A time of day is 0–23 hours and 0–59 minutes',
    );
    expect((await tracker.getMeal(meal.id))?.eatenAt).toEqual(new Date('2026-09-29T08:00:00'));
  });

  it('can be deleted with their Food items', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    const meal = await tracker.createMeal();
    const item = await tracker.addFoodItem(meal.id, yogurt);

    await tracker.deleteMeal(meal.id);

    expect(await tracker.getMeals('2026-09-29')).toEqual([]);
    expect(await tracker.getMeal(meal.id)).toBeUndefined();
    await expect(tracker.deleteMeal(meal.id)).rejects.toThrow('No such Meal');
    await expect(tracker.editFoodItem(item.id, yogurt)).rejects.toThrow('No such Food item');
    await expect(tracker.addFoodItem(meal.id, yogurt)).rejects.toThrow('No such Meal');
  });

  it("show in their day's History", async () => {
    const clock = clockAt('2026-09-28T19:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.createMeal();
    clock.setTime('2026-09-29T08:00:00');
    await tracker.createMeal();

    const day = await tracker.getDay('2026-09-28');

    expect(day.meals.map(meal => meal.name)).toEqual(['Dinner']);
  });
});

describe('Food items', () => {
  it('keep typed calories, and work out blank ones at 4/4/9 kcal per gram of protein, carbs and fat', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();

    await tracker.addFoodItem(meal.id, yogurt);
    await tracker.addFoodItem(meal.id, granola);

    const saved = await tracker.getMeal(meal.id);
    expect(saved?.items.map(item => [item.name, item.quantity, item.unit, item.calories])).toEqual([
      ['Greek yogurt', 170, 'g', 101],
      ['Granola', 1, 'cup', 600],
    ]);
    expect(saved?.totals).toEqual({ calories: 701, protein: 29, carbs: 70, fat: 30 });
  });

  it.each<[string, Partial<FoodItemValues>, string]>([
    ['a name', { name: '  ' }, 'A Food item needs a name'],
    ['a quantity above 0', { quantity: 0 }, 'A Food item needs a quantity above 0'],
    ['a unit', { unit: ' ' }, 'A Food item needs a unit, like g or scoop'],
    [
      'calories of 0 or more',
      { calories: -10 },
      "A Food item's calories and macros must be numbers, 0 or more",
    ],
    [
      'macros that are numbers',
      { protein: Number.NaN },
      "A Food item's calories and macros must be numbers, 0 or more",
    ],
  ])('need %s', async (_, change, problem) => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();

    expect(problemWithFoodItem({ ...yogurt, ...change })).toBe(problem);
    await expect(tracker.addFoodItem(meal.id, { ...yogurt, ...change })).rejects.toThrow(problem);
    expect((await tracker.getMeal(meal.id))?.items).toEqual([]);
  });

  it('take a name, an amount, and calories and macros of 0 or more', () => {
    const water = {
      ...yogurt,
      name: 'Water',
      quantity: 500,
      unit: 'ml',
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    expect(problemWithFoodItem(yogurt)).toBeUndefined();
    expect(problemWithFoodItem({ ...water, calories: 0 })).toBeUndefined();
  });

  it('keep their name and unit without spaces around them', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();

    await tracker.addFoodItem(meal.id, { ...yogurt, name: ' Greek yogurt ', unit: ' g ' });

    const [item] = (await tracker.getMeal(meal.id))?.items ?? [];
    expect([item.name, item.unit]).toEqual(['Greek yogurt', 'g']);
  });

  it('go only in a Meal still there', async () => {
    const tracker = createTracker(createTestDatabase());

    await expect(tracker.addFoodItem('no-such-meal', yogurt)).rejects.toThrow('No such Meal');
  });

  it('can be edited, working calories out again once they are cleared', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();
    const item = await tracker.addFoodItem(meal.id, { ...yogurt, calories: 150 });

    await tracker.editFoodItem(item.id, { ...yogurt, quantity: 340, protein: 34, calories: null });

    const [edited] = (await tracker.getMeal(meal.id))?.items ?? [];
    expect([edited.quantity, edited.protein, edited.calories, edited.typedCalories]).toEqual([
      340,
      34,
      169,
      null,
    ]);
    await expect(tracker.editFoodItem(item.id, { ...yogurt, unit: '' })).rejects.toThrow(
      'A Food item needs a unit',
    );
  });

  it('keep typed calories when their macros change', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();
    const item = await tracker.addFoodItem(meal.id, { ...yogurt, calories: 150 });

    await tracker.editFoodItem(item.id, { ...yogurt, calories: 150, protein: 20 });

    const [edited] = (await tracker.getMeal(meal.id))?.items ?? [];
    expect([edited.protein, edited.calories, edited.typedCalories]).toEqual([20, 150, 150]);
  });

  it('can be deleted, leaving the Meal and its totals', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();
    const item = await tracker.addFoodItem(meal.id, yogurt);
    await tracker.addFoodItem(meal.id, { ...yogurt, name: 'Honey', protein: 0, carbs: 17, fat: 0 });

    await tracker.deleteFoodItem(item.id);

    const saved = await tracker.getMeal(meal.id);
    expect(saved?.items.map(({ name }) => name)).toEqual(['Honey']);
    expect(saved?.totals).toEqual({ calories: 68, protein: 0, carbs: 17, fat: 0 });
    await expect(tracker.deleteFoodItem(item.id)).rejects.toThrow('No such Food item');
    await expect(tracker.editFoodItem(item.id, yogurt)).rejects.toThrow('No such Food item');
  });
});

describe('Copying a Meal', () => {
  it('makes a new Meal today, eaten now, with its name and its Food items as logged', async () => {
    const clock = clockAt('2026-09-27T08:15:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const past = await tracker.createMeal();
    await tracker.renameMeal(past.id, 'Usual breakfast');
    await tracker.addFoodItem(past.id, yogurt);
    await tracker.addFoodItem(past.id, granola);
    clock.setTime('2026-09-29T07:40:00');

    const copy = await tracker.copyMeal(past.id);

    const original = await tracker.getMeal(past.id);
    const copied = await tracker.getMeal(copy.id);
    expect(copied).toMatchObject({
      localDate: '2026-09-29',
      eatenAt: new Date('2026-09-29T07:40:00'),
      name: 'Usual breakfast',
      totals: original?.totals,
    });
    const withoutIds = (meal: typeof copied) => meal?.items.map(({ id, ...item }) => item);
    expect(withoutIds(copied)).toEqual(withoutIds(original));
    expect(copied?.items.map(item => item.typedCalories)).toEqual([null, 600]);
  });

  it('leaves out Food items deleted from the Meal', async () => {
    const tracker = createTracker(createTestDatabase());
    const past = await tracker.createMeal();
    const deleted = await tracker.addFoodItem(past.id, yogurt);
    await tracker.addFoodItem(past.id, granola);
    await tracker.deleteFoodItem(deleted.id);

    const copy = await tracker.copyMeal(past.id);

    expect((await tracker.getMeal(copy.id))?.items.map(item => item.name)).toEqual(['Granola']);
  });

  it('leaves the copy and the original to change apart', async () => {
    const clock = clockAt('2026-09-28T08:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const past = await tracker.createMeal();
    await tracker.addFoodItem(past.id, yogurt);
    clock.setTime('2026-09-29T08:00:00');
    const copy = await tracker.copyMeal(past.id);

    const [copiedItem] = (await tracker.getMeal(copy.id))?.items ?? [];
    await tracker.editFoodItem(copiedItem.id, { ...yogurt, quantity: 250 });
    await tracker.renameMeal(copy.id, 'Big breakfast');

    expect(await tracker.getMeal(past.id)).toMatchObject({
      name: 'Breakfast',
      items: [expect.objectContaining({ quantity: 170 })],
    });
  });

  it('needs a Meal still there', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.createMeal();
    await tracker.deleteMeal(meal.id);

    await expect(tracker.copyMeal(meal.id)).rejects.toThrow('No such Meal');
  });
});

describe('Past Meals', () => {
  it('are listed from before a day, the most recent first, up to a limit', async () => {
    const clock = clockAt('2026-09-26T19:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.createMeal();
    clock.setTime('2026-09-27T08:00:00');
    const breakfast27 = await tracker.createMeal();
    clock.setTime('2026-09-27T12:30:00');
    const lunch27 = await tracker.createMeal();
    clock.setTime('2026-09-28T08:00:00');
    const breakfast28 = await tracker.createMeal();
    const deleted = await tracker.createMeal();
    await tracker.deleteMeal(deleted.id);
    clock.setTime('2026-09-29T08:00:00');
    await tracker.createMeal();

    const past = await tracker.getMealsBefore('2026-09-29', 3);

    expect(past.map(meal => meal.id)).toEqual([breakfast28.id, lunch27.id, breakfast27.id]);
  });
});
