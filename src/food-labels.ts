import type { FoodItem, MacroProgress, Macros, SavedFood } from '@/core/tracker';

// Calories to the nearest whole one, e.g. "101".
export function formatCalories(calories: number): string {
  return String(Math.round(calories));
}

// Grams to at most one decimal place, e.g. "12.5".
function grams(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// An amount of food to at most two decimal places, e.g. "0.25".
function amountOf(value: number): string {
  return String(Math.round(value * 100) / 100);
}

// "520 kcal · P 40 g · C 50 g · F 18 g".
export function describeMacros({ calories, protein, carbs, fat }: Macros): string {
  return `${formatCalories(calories)} kcal · P ${grams(protein)} g · C ${grams(carbs)} g · F ${grams(fat)} g`;
}

// "Greek yogurt · 170 g", a Food item and how much of it.
export function describeFoodItem({ name, quantity, unit }: FoodItem): string {
  return `${name} · ${amountOf(quantity)} ${unit}`;
}

// "100 g", the Serving a Saved food's macros are for.
export function describeServing({ servingAmount, servingUnit }: SavedFood): string {
  return `${amountOf(servingAmount)} ${servingUnit}`;
}

// What calories and each macro are called, in the order they're shown.
export const macroNames: Record<keyof Macros, string> = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

// "701" or "29.5": an amount of calories or of a macro, without its unit.
function numberOf(macro: keyof Macros, value: number): string {
  return macro === 'calories' ? formatCalories(value) : grams(value);
}

// "701 kcal" or "29.5 g".
function measureOf(macro: keyof Macros, value: number): string {
  return `${numberOf(macro, value)} ${macro === 'calories' ? 'kcal' : 'g'}`;
}

// "701 / 2400 kcal" eaten against a target, or "701 kcal" with none set.
export function describeEaten(macro: keyof Macros, { eaten, target }: MacroProgress): string {
  if (target === null) return measureOf(macro, eaten);
  return `${numberOf(macro, eaten)} / ${measureOf(macro, target)}`;
}

// "1699 kcal left", or "9 g over" once past the target; undefined with none.
export function describeLeft(macro: keyof Macros, { left }: MacroProgress): string | undefined {
  if (left === null) return undefined;
  return left >= 0 ? `${measureOf(macro, left)} left` : `${measureOf(macro, -left)} over`;
}
