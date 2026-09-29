import type { FoodItem, Macros } from '@/core/tracker';

// Calories to the nearest whole one, e.g. "101".
export function formatCalories(calories: number): string {
  return String(Math.round(calories));
}

// Grams to at most one decimal place, e.g. "12.5".
function grams(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// "520 kcal · P 40 g · C 50 g · F 18 g".
export function describeMacros({ calories, protein, carbs, fat }: Macros): string {
  return `${formatCalories(calories)} kcal · P ${grams(protein)} g · C ${grams(carbs)} g · F ${grams(fat)} g`;
}

// "Greek yogurt · 170 g", a Food item and how much of it.
export function describeFoodItem({ name, quantity, unit }: FoodItem): string {
  return `${name} · ${Math.round(quantity * 100) / 100} ${unit}`;
}
