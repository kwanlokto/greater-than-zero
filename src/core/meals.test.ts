import { createTestDatabase } from './test-database';
import { clockAt } from './test-helpers';
import { createTracker, problemWithFoodItem, type FoodItemValues } from './tracker';

const yogurt: FoodItemValues = {
  name: 'Greek yogurt',
  quantity: 170,
  unit: 'g',
  calories: null,
  protein: 17,
  carbs: 6,
  fat: 1,
};

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

    const meal = await tracker.addMeal();

    expect(await tracker.getMeal(meal.id)).toMatchObject({
      name,
      eatenAt: clock.now(),
      localDate: '2026-09-29',
    });
  });

  it("are grouped by the phone's local date they were added on, in the order eaten", async () => {
    const clock = clockAt('2026-09-28T23:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.addMeal();
    clock.setTime('2026-09-29T08:00:00');
    const breakfast = await tracker.addMeal();
    clock.setTime('2026-09-29T07:30:00');
    const coffee = await tracker.addMeal();
    clock.setTime('2026-09-30T00:15:00');
    await tracker.addMeal();

    const meals = await tracker.getMeals('2026-09-29');

    expect(meals.map(meal => meal.id)).toEqual([coffee.id, breakfast.id]);
    expect((await tracker.getMeals('2026-09-28')).map(meal => meal.name)).toEqual(['Snack']);
  });

  it('can be renamed and moved to another time that day, keeping the order eaten', async () => {
    const clock = clockAt('2026-09-29T08:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const breakfast = await tracker.addMeal();
    clock.setTime('2026-09-29T12:30:00');
    const lunch = await tracker.addMeal();

    await tracker.editMeal(lunch.id, {
      name: ' Second breakfast ',
      eatenAt: new Date('2026-09-29T07:15:00'),
    });

    const meals = await tracker.getMeals('2026-09-29');
    expect(meals.map(({ id, name }) => [id, name])).toEqual([
      [lunch.id, 'Second breakfast'],
      [breakfast.id, 'Breakfast'],
    ]);
  });

  it("need a name, and a time on the day they're recorded on", async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    const meal = await tracker.addMeal();

    await expect(
      tracker.editMeal(meal.id, { name: ' ', eatenAt: new Date('2026-09-29T09:00:00') }),
    ).rejects.toThrow('A Meal needs a name');
    await expect(
      tracker.editMeal(meal.id, { name: 'Brunch', eatenAt: new Date('2026-09-28T23:00:00') }),
    ).rejects.toThrow("A Meal's time must be on the day it's recorded on");
    expect(await tracker.getMeal(meal.id)).toMatchObject({
      name: 'Breakfast',
      eatenAt: new Date('2026-09-29T08:00:00'),
    });
  });

  it('can be deleted with their Food items', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    const meal = await tracker.addMeal();
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
    await tracker.addMeal();
    clock.setTime('2026-09-29T08:00:00');
    await tracker.addMeal();

    const day = await tracker.getDay('2026-09-28');

    expect(day.meals.map(meal => meal.name)).toEqual(['Dinner']);
  });
});

describe('Food items', () => {
  it('keep typed calories, and work out blank ones at 4/4/9 kcal per gram of protein, carbs and fat', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.addMeal();

    await tracker.addFoodItem(meal.id, {
      name: 'Greek yogurt',
      quantity: 170,
      unit: 'g',
      calories: null,
      protein: 17,
      carbs: 6,
      fat: 1,
    });
    // The label says 600, though 4/4/9 comes to 565.
    await tracker.addFoodItem(meal.id, {
      name: 'Granola',
      quantity: 1,
      unit: 'cup',
      calories: 600,
      protein: 12,
      carbs: 64,
      fat: 29,
    });

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
    const meal = await tracker.addMeal();

    expect(problemWithFoodItem({ ...yogurt, ...change })).toBe(problem);
    await expect(tracker.addFoodItem(meal.id, { ...yogurt, ...change })).rejects.toThrow(problem);
    expect((await tracker.getMeal(meal.id))?.items).toEqual([]);
  });

  it('keep their name and unit without spaces around them', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.addMeal();

    expect(problemWithFoodItem(yogurt)).toBeUndefined();
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
    const meal = await tracker.addMeal();
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

  it('can be deleted, leaving the Meal and its totals', async () => {
    const tracker = createTracker(createTestDatabase());
    const meal = await tracker.addMeal();
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
