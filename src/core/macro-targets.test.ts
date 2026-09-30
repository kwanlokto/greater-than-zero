import { createTestDatabase } from './test-database';
import { clockAt, granola, yogurt } from './test-helpers';
import { createTracker, problemWithMacroTargets, type MacroTargets } from './tracker';

const cutting: MacroTargets = { calories: 2400, protein: 180, carbs: 250, fat: 70 };

describe('Macro targets', () => {
  it('are unset on a fresh install', async () => {
    const tracker = createTracker(createTestDatabase());

    expect(await tracker.getMacroTargets()).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    });
  });

  it('read back as set, each one optional', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setMacroTargets(cutting);

    await tracker.setMacroTargets({ ...cutting, carbs: null, fat: null });

    expect(await tracker.getMacroTargets()).toEqual({
      calories: 2400,
      protein: 180,
      carbs: null,
      fat: null,
    });
  });

  it.each<[string, Partial<MacroTargets>]>([
    ['0', { fat: 0 }],
    ['below 0', { calories: -100 }],
    ['not a number', { protein: Number.NaN }],
  ])('refuse a target of %s, keeping the ones set before', async (_, change) => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setMacroTargets(cutting);
    const problem = 'Macro targets must be numbers above 0, or left blank';

    expect(problemWithMacroTargets(cutting)).toBeUndefined();
    expect(problemWithMacroTargets({ ...cutting, ...change })).toBe(problem);
    await expect(tracker.setMacroTargets({ ...cutting, ...change })).rejects.toThrow(problem);
    expect(await tracker.getMacroTargets()).toEqual(cutting);
  });
});

describe('Daily totals', () => {
  it("add up the Meals added on a local date, and only that day's", async () => {
    const clock = clockAt('2026-09-28T23:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const lateSnack = await tracker.createMeal();
    await tracker.addFoodItem(lateSnack.id, granola);
    clock.setTime('2026-09-29T08:00:00');
    const breakfast = await tracker.createMeal();
    await tracker.addFoodItem(breakfast.id, yogurt);
    await tracker.addFoodItem(breakfast.id, granola);
    const mistake = await tracker.addFoodItem(breakfast.id, granola);
    await tracker.deleteFoodItem(mistake.id);
    const deletedMeal = await tracker.createMeal();
    await tracker.addFoodItem(deletedMeal.id, granola);
    await tracker.deleteMeal(deletedMeal.id);

    const day = await tracker.getDailyTotals('2026-09-29');

    expect([day.calories.eaten, day.protein.eaten, day.carbs.eaten, day.fat.eaten]).toEqual([
      701, 29, 70, 30,
    ]);
    const dayBefore = await tracker.getDailyTotals('2026-09-28');
    expect(dayBefore.calories.eaten).toBe(600);
  });

  it('compare what was eaten with each target set, going below 0 once over', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    await tracker.setMacroTargets({ calories: 2400, protein: 20, carbs: null, fat: null });
    const breakfast = await tracker.createMeal();
    await tracker.addFoodItem(breakfast.id, yogurt);
    await tracker.addFoodItem(breakfast.id, granola);

    expect(await tracker.getDailyTotals('2026-09-29')).toEqual({
      calories: { eaten: 701, target: 2400, left: 1699 },
      protein: { eaten: 29, target: 20, left: -9 },
      carbs: { eaten: 70, target: null, left: null },
      fat: { eaten: 30, target: null, left: null },
    });
  });

  it('leave 0 when what was eaten is right on the target', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T08:00:00'));
    await tracker.setMacroTargets({ calories: 701, protein: null, carbs: null, fat: null });
    const breakfast = await tracker.createMeal();
    await tracker.addFoodItem(breakfast.id, yogurt);
    await tracker.addFoodItem(breakfast.id, granola);

    const day = await tracker.getDailyTotals('2026-09-29');

    expect(day.calories).toEqual({ eaten: 701, target: 701, left: 0 });
  });

  it('are nothing eaten on a day without Meals', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setMacroTargets({ calories: 2400, protein: null, carbs: null, fat: null });

    const day = await tracker.getDailyTotals('2026-09-29');

    expect(day.calories).toEqual({ eaten: 0, target: 2400, left: 2400 });
    expect(day.protein).toEqual({ eaten: 0, target: null, left: null });
  });
});
