import type { FoodItem, Macros } from '@/core/tracker';

// Grams to at most one decimal place, e.g. "12.5".
function grams(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// "520 kcal · P 40 g · C 50 g · F 18 g", calories to the nearest whole one.
export function describeMacros({ calories, protein, carbs, fat }: Macros): string {
  return `${Math.round(calories)} kcal · P ${grams(protein)} g · C ${grams(carbs)} g · F ${grams(fat)} g`;
}

// "170 g", "1 scoop".
export function describeQuantity({ quantity, unit }: Pick<FoodItem, 'quantity' | 'unit'>): string {
  return `${Math.round(quantity * 100) / 100} ${unit}`;
}
