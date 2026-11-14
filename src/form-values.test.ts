import {
  problemWithFoodItem,
  problemWithSavedFood,
  type FoodValues,
  type SavedFood,
} from '@/core/tracker';
import {
  caloriesWorkedOut,
  foodBoxesOf,
  macroTargetBoxesOf,
  portionBoxOf,
  readFood,
  readMacroTargets,
  readPortion,
  readSet,
  readTarget,
  readWeighIn,
  setBoxesOf,
  targetBoxesOf,
} from './form-values';

const foodItemRule = (values: FoodValues) =>
  problemWithFoodItem({ ...values, quantity: values.amount });
const savedFoodRule = ({ amount, unit, ...values }: FoodValues) =>
  problemWithSavedFood({ ...values, servingAmount: amount, servingUnit: unit });

const blankFood = { name: '', amount: '', unit: 'g', calories: '', protein: '', carbs: '', fat: '' };
const yogurt = { ...blankFood, name: 'Greek yogurt', amount: '170' };

describe('Reading a Set', () => {
  it('waits for the reps, and for the weight of a weighted Exercise, without saying why', () => {
    expect(readSet('weighted', { weight: '60', reps: '' }, false)).toEqual({});
    expect(readSet('weighted', { weight: '', reps: '8' }, false)).toEqual({});
    expect(readSet('bodyweight', { weight: '', reps: ' ' }, false)).toEqual({});
  });

  it('reads the weight and reps, with the warm-up mark', () => {
    expect(readSet('weighted', { weight: '62.5', reps: '8' }, true)).toEqual({
      values: { weight: 62.5, reps: 8, isWarmUp: true },
    });
  });

  it('takes a comma as the decimal point', () => {
    expect(readSet('weighted', { weight: '62,5', reps: '8' }, false).values?.weight).toBe(62.5);
  });

  it("reads a bodyweight Set's blank added weight as plain bodyweight", () => {
    expect(readSet('bodyweight', { weight: '', reps: '10' }, false)).toEqual({
      values: { weight: null, reps: 10, isWarmUp: false },
    });
    expect(readSet('bodyweight', { weight: '-20', reps: '10' }, false).values?.weight).toBe(-20);
  });

  it("says what the core says once they're filled", () => {
    expect(readSet('weighted', { weight: '-5', reps: '8' }, false)).toEqual({
      problem: 'Only bodyweight Sets can have a negative weight',
    });
    expect(readSet('weighted', { weight: '60', reps: '0' }, false)).toEqual({
      problem: 'A Set needs a whole number of reps, at least 1',
    });
    expect(readSet('weighted', { weight: '60', reps: '8.5' }, false)).toEqual({
      problem: 'A Set needs a whole number of reps, at least 1',
    });
  });

  it("says when a box doesn't hold a number", () => {
    expect(readSet('weighted', { weight: '6.6.6', reps: '8' }, false)).toEqual({
      problem: "A Set's weight must be a number",
    });
  });

  it('opens a logged Set as it was entered, and reads it back unchanged', () => {
    const logged = { weight: 62.5, reps: 5 };
    const boxes = setBoxesOf(logged);

    expect(boxes).toEqual({ weight: '62.5', reps: '5' });
    expect(readSet('weighted', boxes, false, logged).values).toEqual({ ...logged, isWarmUp: false });
    expect(setBoxesOf({ weight: null, reps: 12 })).toEqual({ weight: '', reps: '12' });
  });
});

describe('Reading a Target', () => {
  const newTarget = { sets: '3', minReps: '8', maxReps: '12', weight: '' };

  it('waits quietly for the weight of a new weighted Target', () => {
    expect(readTarget('weighted', newTarget, 'kg')).toEqual({});
  });

  it('waits for the sets and both ends of the rep range', () => {
    expect(readTarget('bodyweight', { ...newTarget, sets: '' }, 'kg')).toEqual({});
    expect(readTarget('bodyweight', { ...newTarget, maxReps: '' }, 'kg')).toEqual({});
  });

  it('reads a bodyweight Target with no added weight', () => {
    expect(readTarget('bodyweight', newTarget, 'lb')).toEqual({
      values: { sets: 3, minReps: 8, maxReps: 12, weight: null, weightUnit: 'lb' },
    });
  });

  it("says what the core says once they're filled", () => {
    expect(readTarget('weighted', { ...newTarget, weight: '60', sets: '0' }, 'kg')).toEqual({
      problem: 'A Target needs a whole number of sets, at least 1',
    });
    expect(readTarget('weighted', { ...newTarget, weight: '60', minReps: '15' }, 'kg')).toEqual({
      problem: "A rep range's minimum can't be more than its maximum",
    });
  });

  it('opens a Target as it was entered', () => {
    const target = { sets: 3, minReps: 5, maxReps: 8, weight: 102.5 };

    expect(targetBoxesOf(target)).toEqual({ sets: '3', minReps: '5', maxReps: '8', weight: '102.5' });
    expect(readTarget('weighted', targetBoxesOf(target), 'kg', target).values).toEqual({
      ...target,
      weightUnit: 'kg',
    });
  });
});

describe('Reading a food', () => {
  it('waits quietly for the name, amount and unit', () => {
    expect(readFood({ ...yogurt, name: ' ', protein: '-1' }, foodItemRule)).toEqual({});
    expect(readFood({ ...yogurt, amount: '' }, foodItemRule)).toEqual({});
    expect(readFood({ ...yogurt, unit: '' }, foodItemRule)).toEqual({});
  });

  it('leaves blank calories to be worked out, and counts a blank macro as none', () => {
    expect(readFood({ ...yogurt, protein: '17' }, foodItemRule)).toEqual({
      values: {
        name: 'Greek yogurt',
        amount: 170,
        unit: 'g',
        calories: null,
        protein: 17,
        carbs: 0,
        fat: 0,
      },
    });
  });

  it("says what the core says for each kind of food, once it's filled", () => {
    expect(readFood({ ...yogurt, amount: '0' }, foodItemRule)).toEqual({
      problem: 'A Food item needs a quantity above 0',
    });
    expect(readFood({ ...yogurt, amount: '0' }, savedFoodRule)).toEqual({
      problem: 'A Saved food needs a serving amount above 0',
    });
    expect(readFood({ ...yogurt, fat: '-2' }, foodItemRule)).toEqual({
      problem: "A Food item's calories and macros must be numbers, 0 or more",
    });
  });

  it('shows a portion worked out from a Saved food rounded, as everywhere else', () => {
    // 50 g of a food with 20 g of protein in 150 g.
    const portion = {
      name: 'Oats',
      amount: 50,
      unit: 'g',
      calories: 63.333333333333336,
      protein: 6.666666666666667,
      carbs: 20,
      fat: 1.1666666666666667,
    };

    expect(foodBoxesOf(portion)).toEqual({
      name: 'Oats',
      amount: '50',
      unit: 'g',
      calories: '63',
      protein: '6.7',
      carbs: '20',
      fat: '1.2',
    });
  });

  it('keeps the stored numbers of boxes left as they opened, and reads the ones changed', () => {
    const portion = {
      name: 'Oats',
      amount: 33.333,
      unit: 'g',
      calories: 63.333333333333336,
      protein: 6.666666666666667,
      carbs: 20,
      fat: 1.1666666666666667,
    };
    const boxes = foodBoxesOf(portion);

    expect(readFood(boxes, foodItemRule, portion).values).toEqual(portion);
    expect(readFood({ ...boxes, protein: '7' }, foodItemRule, portion).values).toEqual({
      ...portion,
      protein: 7,
    });
  });

  it('works out the calories the macro boxes come to', () => {
    // 4 × 10 + 4 × 20 + 9 × 5
    expect(caloriesWorkedOut({ ...blankFood, protein: '10', carbs: '20', fat: '5' })).toBe(165);
    expect(caloriesWorkedOut(blankFood)).toBe(0);
    expect(caloriesWorkedOut({ ...blankFood, fat: '1..5' })).toBeUndefined();
  });
});

describe('Reading a portion of a Saved food', () => {
  const oats: SavedFood = {
    id: 'oats',
    name: 'Oats',
    servingAmount: 33.333,
    servingUnit: 'g',
    calories: 120,
    typedCalories: null,
    protein: 4,
    carbs: 20,
    fat: 2,
  };

  it('waits quietly for an amount', () => {
    expect(readPortion(oats, '')).toEqual({});
  });

  it("says what the core says once it's filled", () => {
    expect(readPortion(oats, '0')).toEqual({ problem: 'A Food item needs a quantity above 0' });
  });

  it('keeps the exact Serving while the box shows it, as it opens', () => {
    expect(portionBoxOf(oats.servingAmount)).toBe('33.33');
    expect(readPortion(oats, portionBoxOf(oats.servingAmount))).toEqual({ values: 33.333 });
    expect(readPortion(oats, '50')).toEqual({ values: 50 });
  });
});

describe('Reading Macro targets', () => {
  const none = { calories: '', protein: '', carbs: '', fat: '' };

  it('reads blank ones as no target, with none needed', () => {
    expect(readMacroTargets(none)).toEqual({
      values: { calories: null, protein: null, carbs: null, fat: null },
    });
  });

  it("says what the core says straight away, as there's nothing to wait for", () => {
    const problem = 'Macro targets must be numbers above 0, or left blank';

    expect(readMacroTargets({ ...none, carbs: '0' })).toEqual({ problem });
    expect(readMacroTargets({ ...none, fat: '7..5' })).toEqual({ problem });
  });

  it('opens targets the way Settings shows them, keeping them if left alone', () => {
    const targets = { calories: 2150.5, protein: 162.25, carbs: null, fat: 70 };
    const boxes = macroTargetBoxesOf(targets);

    expect(boxes).toEqual({ calories: '2151', protein: '162.3', carbs: '', fat: '70' });
    expect(readMacroTargets(boxes, targets).values).toEqual(targets);
  });
});

describe('Reading a Weigh-in', () => {
  it('waits quietly for a weight', () => {
    expect(readWeighIn('')).toEqual({});
  });

  it('reads the weight, with a comma as the decimal point', () => {
    expect(readWeighIn('82,4')).toEqual({ values: 82.4 });
  });

  it("says what the core says once it's filled", () => {
    expect(readWeighIn('0')).toEqual({ problem: 'A Weigh-in needs a weight above 0' });
  });
});
