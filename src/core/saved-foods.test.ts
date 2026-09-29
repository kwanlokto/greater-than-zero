import { createTestDatabase } from './test-database';
import {
  createTracker,
  problemWithPortion,
  problemWithSavedFood,
  type SavedFoodValues,
} from './tracker';

// Per 100 g, as on the label.
const oats: SavedFoodValues = {
  name: 'Rolled oats',
  servingAmount: 100,
  servingUnit: 'g',
  calories: 379,
  protein: 13,
  carbs: 68,
  fat: 6.5,
};

// Per scoop, with calories left to the macros.
const whey: SavedFoodValues = {
  name: 'Whey protein',
  servingAmount: 1,
  servingUnit: 'scoop',
  calories: null,
  protein: 24,
  carbs: 3,
  fat: 1,
};

describe('Saved foods', () => {
  it('hold a Serving and its macros, listed by name', async () => {
    const tracker = createTracker(createTestDatabase());

    await tracker.createSavedFood(whey);
    await tracker.createSavedFood(oats);

    const saved = await tracker.getSavedFoods();
    expect(
      saved.map(food => [food.name, food.servingAmount, food.servingUnit, food.calories]),
    ).toEqual([
      ['Rolled oats', 100, 'g', 379],
      // 4 × 24 + 4 × 3 + 9 × 1
      ['Whey protein', 1, 'scoop', 117],
    ]);
  });

  it.each<[string, Partial<SavedFoodValues>, string]>([
    ['a name', { name: ' ' }, 'A Saved food needs a name'],
    [
      'a serving amount above 0',
      { servingAmount: 0 },
      'A Saved food needs a serving amount above 0',
    ],
    ['a serving unit', { servingUnit: '' }, 'A Saved food needs a serving unit, like g or scoop'],
    [
      'calories and macros of 0 or more',
      { fat: -1 },
      "A Saved food's calories and macros must be numbers, 0 or more",
    ],
  ])('need %s', async (_, change, problem) => {
    const tracker = createTracker(createTestDatabase());

    expect(problemWithSavedFood({ ...oats, ...change })).toBe(problem);
    await expect(tracker.createSavedFood({ ...oats, ...change })).rejects.toThrow(problem);
    expect(await tracker.getSavedFoods()).toEqual([]);
  });

  it('keep their name and serving unit without spaces around them', async () => {
    const tracker = createTracker(createTestDatabase());

    await tracker.createSavedFood({ ...oats, name: ' Rolled oats ', servingUnit: ' g ' });

    const [saved] = await tracker.getSavedFoods();
    expect([saved.name, saved.servingUnit]).toEqual(['Rolled oats', 'g']);
  });

  it('can be edited, working calories out again once they are cleared', async () => {
    const tracker = createTracker(createTestDatabase());
    const saved = await tracker.createSavedFood(oats);

    await tracker.editSavedFood(saved.id, {
      ...oats,
      servingAmount: 40,
      calories: null,
      protein: 5,
    });

    expect(await tracker.getSavedFood(saved.id)).toMatchObject({
      servingAmount: 40,
      protein: 5,
      typedCalories: null,
      // 4 × 5 + 4 × 68 + 9 × 6.5
      calories: 350.5,
    });
    await expect(tracker.editSavedFood(saved.id, { ...oats, name: '' })).rejects.toThrow(
      'A Saved food needs a name',
    );
  });

  it('can be deleted, leaving the list', async () => {
    const tracker = createTracker(createTestDatabase());
    const saved = await tracker.createSavedFood(oats);
    await tracker.createSavedFood(whey);

    await tracker.deleteSavedFood(saved.id);

    expect((await tracker.getSavedFoods()).map(food => food.name)).toEqual(['Whey protein']);
    expect(await tracker.getSavedFood(saved.id)).toBeUndefined();
    await expect(tracker.deleteSavedFood(saved.id)).rejects.toThrow('No such Saved food');
    await expect(tracker.editSavedFood(saved.id, oats)).rejects.toThrow('No such Saved food');
  });
});

describe('Adding a Saved food to a Meal', () => {
  it('copies it at a quantity in its Serving unit, with its macros scaled to match', async () => {
    const tracker = createTracker(createTestDatabase());
    const savedOats = await tracker.createSavedFood(oats);
    const savedWhey = await tracker.createSavedFood(whey);
    const meal = await tracker.createMeal();

    await tracker.addSavedFoodToMeal(meal.id, savedOats.id, 150);
    await tracker.addSavedFoodToMeal(meal.id, savedWhey.id, 2);

    const items = (await tracker.getMeal(meal.id))?.items ?? [];
    expect(
      items.map(item => [
        item.name,
        item.quantity,
        item.unit,
        item.calories,
        item.protein,
        item.carbs,
        item.fat,
        item.savedFoodId,
      ]),
    ).toEqual([
      // 1.5 servings of 100 g, typed calories scaled too.
      ['Rolled oats', 150, 'g', 568.5, 19.5, 102, 9.75, savedOats.id],
      // 2 scoops, calories worked out from the scaled macros.
      ['Whey protein', 2, 'scoop', 234, 48, 6, 2, savedWhey.id],
    ]);
  });

  it('keeps the copy as it was logged when the Saved food is later changed or deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const savedOats = await tracker.createSavedFood(oats);
    const savedWhey = await tracker.createSavedFood(whey);
    const meal = await tracker.createMeal();
    await tracker.addSavedFoodToMeal(meal.id, savedOats.id, 50);
    await tracker.addSavedFoodToMeal(meal.id, savedWhey.id, 1);
    const logged = await tracker.getMeal(meal.id);

    await tracker.editSavedFood(savedOats.id, {
      ...oats,
      name: 'Oats',
      calories: 400,
      protein: 15,
    });
    // Its calories are worked out from its macros, which change.
    await tracker.editSavedFood(savedWhey.id, { ...whey, protein: 30, fat: 2 });
    expect(await tracker.getMeal(meal.id)).toEqual(logged);

    await tracker.deleteSavedFood(savedOats.id);
    await tracker.deleteSavedFood(savedWhey.id);
    expect(await tracker.getMeal(meal.id)).toEqual(logged);
  });

  it('stays linked to the Saved food when the Food item is edited', async () => {
    const tracker = createTracker(createTestDatabase());
    const savedOats = await tracker.createSavedFood(oats);
    const meal = await tracker.createMeal();
    const item = await tracker.addSavedFoodToMeal(meal.id, savedOats.id, 50);

    await tracker.editFoodItem(item.id, {
      name: 'Steel-cut oats',
      quantity: 50,
      unit: 'g',
      calories: 190,
      protein: 6.5,
      carbs: 34,
      fat: 3.25,
    });

    const [edited] = (await tracker.getMeal(meal.id))?.items ?? [];
    expect([edited.name, edited.savedFoodId]).toEqual(['Steel-cut oats', savedOats.id]);
  });

  it('takes only the values when a Food item is edited with another whole Food item', async () => {
    const tracker = createTracker(createTestDatabase());
    const savedOats = await tracker.createSavedFood(oats);
    const savedWhey = await tracker.createSavedFood(whey);
    const meal = await tracker.createMeal();
    await tracker.addSavedFoodToMeal(meal.id, savedOats.id, 50);
    await tracker.addSavedFoodToMeal(meal.id, savedWhey.id, 1);
    const [oatsItem, wheyItem] = (await tracker.getMeal(meal.id))?.items ?? [];

    await tracker.editFoodItem(oatsItem.id, { ...wheyItem, calories: wheyItem.typedCalories });

    const [edited] = (await tracker.getMeal(meal.id))?.items ?? [];
    expect([edited.id, edited.name, edited.savedFoodId]).toEqual([
      oatsItem.id,
      'Whey protein',
      savedOats.id,
    ]);
  });

  it('needs a quantity above 0, a Saved food still there and a Meal still there', async () => {
    const tracker = createTracker(createTestDatabase());
    const savedOats = await tracker.createSavedFood(oats);
    const savedWhey = await tracker.createSavedFood(whey);
    await tracker.deleteSavedFood(savedWhey.id);
    const meal = await tracker.createMeal();
    const deletedMeal = await tracker.createMeal();
    await tracker.deleteMeal(deletedMeal.id);

    const saved = await tracker.getSavedFood(savedOats.id);
    expect(saved && problemWithPortion(saved, 50)).toBeUndefined();
    expect(saved && problemWithPortion(saved, 0)).toBe('A Food item needs a quantity above 0');
    await expect(tracker.addSavedFoodToMeal(meal.id, savedOats.id, 0)).rejects.toThrow(
      'A Food item needs a quantity above 0',
    );
    await expect(tracker.addSavedFoodToMeal(meal.id, savedWhey.id, 1)).rejects.toThrow(
      'No such Saved food',
    );
    await expect(tracker.addSavedFoodToMeal(deletedMeal.id, savedOats.id, 1)).rejects.toThrow(
      'No such Meal',
    );
    expect((await tracker.getMeal(meal.id))?.items).toEqual([]);
  });
});
