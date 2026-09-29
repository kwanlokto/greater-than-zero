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

// What the lifter can change about a Meal. Its day stays the one it was
// added on.
export type MealChanges = {
  name: string;
  eatenAt: Date;
};

// A new Meal's name, from the time of day it's added. Always editable.
export function defaultMealName(time: Date): string {
  const hour = time.getHours();
  if (hour >= 4 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 15) return 'Lunch';
  if (hour >= 17 && hour < 22) return 'Dinner';
  return 'Snack';
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

// Why a Food item can't be saved with these values, or undefined when it can.
// The Food item commands enforce it; screens use it to decide when to allow
// saving.
export function problemWithFoodItem(values: FoodItemValues): string | undefined {
  const { name, quantity, unit, calories, protein, carbs, fat } = values;
  if (!name.trim()) return 'A Food item needs a name';
  if (!Number.isFinite(quantity) || quantity <= 0) return 'A Food item needs a quantity above 0';
  if (!unit.trim()) return 'A Food item needs a unit, like g or scoop';
  const amounts = calories === null ? [protein, carbs, fat] : [calories, protein, carbs, fat];
  if (!amounts.every(amount => Number.isFinite(amount) && amount >= 0)) {
    return "A Food item's calories and macros must be numbers, 0 or more";
  }
  return undefined;
}

// The values to save: checked, with the name and unit trimmed.
export function foodItemColumns(values: FoodItemValues): FoodItemValues {
  const problem = problemWithFoodItem(values);
  if (problem) throw new Error(problem);
  return { ...values, name: values.name.trim(), unit: values.unit.trim() };
}
