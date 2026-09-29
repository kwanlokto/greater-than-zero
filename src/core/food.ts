// Meals and the Food items they're made of.

// Calories, and the grams of each macro.
export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// What the lifter enters for a Food item. Calories are left null to work them
// out from the macros.
export type FoodItemValues = {
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// A food in a Meal, keeping its own name, amount and macros.
export type FoodItem = Macros & {
  id: string;
  name: string;
  // How much, in `unit` (e.g. 150 g, 1 scoop).
  quantity: number;
  unit: string;
  // As typed, or null when `calories` is worked out from the macros.
  typedCalories: number | null;
  // The Saved food it was added from, if any. Only a record of where it came
  // from: its own copies of the name and macros are what count.
  savedFoodId: string | null;
};

// What the lifter enters for a Saved food: a Serving, such as 100 g or 1
// scoop, and its macros. Calories are left null to work them out from the
// macros.
export type SavedFoodValues = {
  name: string;
  servingAmount: number;
  servingUnit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// A food kept to add to Meals again. Its macros are for one Serving.
export type SavedFood = Macros & {
  id: string;
  name: string;
  servingAmount: number;
  servingUnit: string;
  // As typed, or null when `calories` is worked out from the macros.
  typedCalories: number | null;
};

// Something eaten at one time, made of Food items.
export type Meal = {
  id: string;
  // The phone's local calendar date it was added on, as YYYY-MM-DD.
  localDate: string;
  eatenAt: Date;
  name: string;
  // In the order they were added.
  items: FoodItem[];
  // Its Food items' added up.
  totals: Macros;
};

// A time on a clock, e.g. 7:15 as { hours: 7, minutes: 15 }.
export type TimeOfDay = {
  hours: number;
  minutes: number;
};

// A new Meal's name, from the time of day it's added. Always editable.
export function defaultMealName(time: Date): string {
  const hour = time.getHours();
  if (hour >= 4 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 15) return 'Lunch';
  if (hour >= 17 && hour < 22) return 'Dinner';
  return 'Snack';
}

export function requireMealName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Meal needs a name');
  return name;
}

// The moment `time` comes on a YYYY-MM-DD local date, so a Meal moved to
// another time stays on its day.
export function timeOnDay(localDate: string, { hours, minutes }: TimeOfDay): Date {
  const isWhole = (value: number, below: number) =>
    Number.isInteger(value) && value >= 0 && value < below;
  if (!isWhole(hours, 24) || !isWhole(minutes, 60)) {
    throw new Error('A time of day is 0–23 hours and 0–59 minutes');
  }
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

// Calories from the macros: 4 kcal per gram of protein and of carbs, 9 per
// gram of fat.
export function caloriesFromMacros({ protein, carbs, fat }: Omit<Macros, 'calories'>): number {
  return 4 * protein + 4 * carbs + 9 * fat;
}

// Several Food items' macros added up.
export function totalsOf(items: Macros[]): Macros {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// How a kind of food is named when saying what's wrong with it, e.g. "A Saved
// food" needs "a serving amount".
type FoodNouns = { subject: string; amountNoun: string; unitNoun: string };

// A Food item or a Saved food: a name, an amount in a unit, and the macros of
// that much. For a Food item the amount is how much was eaten; for a Saved
// food it's the Serving its macros are for. Null calories are worked out from
// the macros.
export type FoodValues = {
  name: string;
  amount: number;
  unit: string;
  calories: number | null;
  protein: number;
  carbs: number;
  fat: number;
};

// The rule Food items and Saved foods share: a name, an amount above 0 in a
// unit, and calories (when typed) and macros of 0 or more.
function problemWithFood(nouns: FoodNouns, food: FoodValues): string | undefined {
  const { subject, amountNoun, unitNoun } = nouns;
  const { name, amount, unit, calories, protein, carbs, fat } = food;
  if (!name.trim()) return `${subject} needs a name`;
  if (!Number.isFinite(amount) || amount <= 0) return `${subject} needs ${amountNoun} above 0`;
  if (!unit.trim()) return `${subject} needs ${unitNoun}, like g or scoop`;
  const amounts = calories === null ? [protein, carbs, fat] : [calories, protein, carbs, fat];
  if (!amounts.every(value => Number.isFinite(value) && value >= 0)) {
    return `${subject}'s calories and macros must be numbers, 0 or more`;
  }
  return undefined;
}

// Why a Food item can't be saved with these values, or undefined when it can.
// The Food item commands enforce it; screens use it to decide when to allow
// saving.
export function problemWithFoodItem(values: FoodItemValues): string | undefined {
  const nouns = { subject: 'A Food item', amountNoun: 'a quantity', unitNoun: 'a unit' };
  return problemWithFood(nouns, { ...values, amount: values.quantity });
}

// The same for a Saved food, whose amount is its Serving.
export function problemWithSavedFood(values: SavedFoodValues): string | undefined {
  const nouns = {
    subject: 'A Saved food',
    amountNoun: 'a serving amount',
    unitNoun: 'a serving unit',
  };
  return problemWithFood(nouns, {
    ...values,
    amount: values.servingAmount,
    unit: values.servingUnit,
  });
}

// The values to save: checked against problemWithFoodItem, with the name and
// unit trimmed. Only these, so a whole Food item passed in can't change which
// row it is or the Saved food it's linked to.
export function requireValidFoodItem(values: FoodItemValues): FoodItemValues {
  const problem = problemWithFoodItem(values);
  if (problem) throw new Error(problem);
  const { name, quantity, unit, calories, protein, carbs, fat } = values;
  return { name: name.trim(), quantity, unit: unit.trim(), calories, protein, carbs, fat };
}

// The values to save: checked against problemWithSavedFood, with the name and
// serving unit trimmed. Only these, as for a Food item.
export function requireValidSavedFood(values: SavedFoodValues): SavedFoodValues {
  const problem = problemWithSavedFood(values);
  if (problem) throw new Error(problem);
  const { name, servingAmount, servingUnit, calories, protein, carbs, fat } = values;
  return {
    name: name.trim(),
    servingAmount,
    servingUnit: servingUnit.trim(),
    calories,
    protein,
    carbs,
    fat,
  };
}

// A Food item or Saved food as read back: its calories as typed, or worked
// out from its macros when none were, so they follow any change to them.
export function withCaloriesWorkedOut<
  Row extends Omit<Macros, 'calories'> & { calories: number | null },
>({ calories, ...row }: Row): Omit<Row, 'calories'> & Pick<FoodItem, 'calories' | 'typedCalories'> {
  return { ...row, typedCalories: calories, calories: calories ?? caloriesFromMacros(row) };
}

// The macros of `quantity` of a Saved food, in its Serving unit: its macros ×
// quantity ÷ serving amount. There's no converting between units.
export function portionOf(savedFood: SavedFood, quantity: number): Macros {
  const servings = quantity / savedFood.servingAmount;
  return {
    calories: savedFood.calories * servings,
    protein: savedFood.protein * servings,
    carbs: savedFood.carbs * servings,
    fat: savedFood.fat * servings,
  };
}

// A Food item of `quantity` of a Saved food, in its Serving unit: its own copy
// of the name, and the macros of that portion (see portionOf). Calories left
// blank on the Saved food stay blank, to be worked out from the portion's
// macros, which comes to the same.
export function foodItemFromSavedFood(savedFood: SavedFood, quantity: number): FoodItemValues {
  const { calories, ...macros } = portionOf(savedFood, quantity);
  return {
    name: savedFood.name,
    quantity,
    unit: savedFood.servingUnit,
    calories: savedFood.typedCalories === null ? null : calories,
    ...macros,
  };
}

// Why `quantity` of a Saved food can't be added to a Meal, or undefined when
// it can: the Food item rule, for the copy it would add. addSavedFoodToMeal
// enforces it; screens use it to decide when to allow adding.
export function problemWithPortion(savedFood: SavedFood, quantity: number): string | undefined {
  return problemWithFoodItem(foodItemFromSavedFood(savedFood, quantity));
}
