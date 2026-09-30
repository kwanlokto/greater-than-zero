import type {
  DailyTotals,
  FoodItem,
  Macro,
  MacroProgress,
  Macros,
  SavedFood,
} from '@/core/tracker';

// An amount as shown: calories to the nearest whole one, grams to one decimal
// place.
function roundedIn(unit: 'kcal' | 'g', value: number): number {
  return unit === 'kcal' ? Math.round(value) : Math.round(value * 10) / 10;
}

// Calories to the nearest whole one, e.g. "101".
export function formatCalories(calories: number): string {
  return String(roundedIn('kcal', calories));
}

// Grams to at most one decimal place, e.g. "12.5".
function grams(value: number): string {
  return String(roundedIn('g', value));
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

// Calories and each macro, in the order they're shown, with their names and
// units.
export const macros: Macro[] = ['calories', 'protein', 'carbs', 'fat'];

export const macroNames: Record<Macro, string> = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

export const macroUnits: Record<Macro, 'kcal' | 'g'> = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
};

function rounded(macro: Macro, value: number): number {
  return roundedIn(macroUnits[macro], value);
}

// "701 kcal" or "29.5 g".
function measureOf(macro: Macro, value: number): string {
  return `${rounded(macro, value)} ${macroUnits[macro]}`;
}

// "701 / 2400 kcal" eaten against a target, or "701 kcal" with none set.
export function describeEaten(macro: Macro, { eaten, target }: MacroProgress): string {
  if (target === null) return measureOf(macro, eaten);
  return `${rounded(macro, eaten)} / ${measureOf(macro, target)}`;
}

// Whether it's gone over its target, going by the amounts as shown, so what's
// left rounding to 0 isn't "0 over".
export function isOver(macro: Macro, { left }: MacroProgress): boolean {
  return left !== null && rounded(macro, left) < 0;
}

// "1699 kcal left", or "9 g over" once past the target; undefined with none.
export function describeLeft(macro: Macro, progress: MacroProgress): string | undefined {
  const { left } = progress;
  if (left === null) return undefined;
  return isOver(macro, progress)
    ? `${measureOf(macro, -left)} over`
    : `${measureOf(macro, Math.max(0, left))} left`;
}

// Whether any Macro target is set, to measure a day against.
export function hasMacroTargets(totals: DailyTotals): boolean {
  return macros.some(macro => totals[macro].target !== null);
}
