// What the lifter types into a form's boxes, read as the values a core command
// takes, and a stored record turned back into box text. Every form that takes
// numbers reads its boxes here, so they all follow the same rules:
//
// - While a box that must be filled is blank, nothing is said: the form isn't
//   ready, and its button stays greyed out.
// - Once those are filled, the core's own rule decides, and what it says is
//   the problem to show. Something that isn't a number counts as filled, so
//   the core's "must be a number" says so.
// - A stored number shows the way the app shows it elsewhere, and a box left
//   as it opened keeps the stored number, so opening and saving changes
//   nothing.
//
// What a blank box means depends on the kind: blank added weight is plain
// bodyweight, blank calories are worked out from the macros, a blank macro is
// none, and a blank Macro target is no target.

import {
  caloriesFromMacros,
  problemWithMacroTargets,
  problemWithPortion,
  problemWithSet,
  problemWithTarget,
  problemWithWeighIn,
  type FoodValues,
  type MacroTargets,
  type SavedFood,
  type SetValues,
  type TargetValues,
  type TrackingType,
  type WeightUnit,
} from '@/core/tracker';
import { formatCalories, formatGrams, roundedAmount } from '@/food-labels';

// What a form's boxes come to: the values to save once they're ready, or the
// problem to show. Neither while a box that must be filled is blank.
export type Reading<Values> =
  | { values: Values; problem?: undefined }
  | { values?: undefined; problem: string }
  | { values?: undefined; problem?: undefined };

const notReady: Reading<never> = {};

function judged<Values>(values: Values, problem: string | undefined): Reading<Values> {
  return problem === undefined ? { values } : { problem };
}

function isBlank(text: string): boolean {
  return text.trim() === '';
}

// How a stored number shows in a box.
type Shown = (value: number) => string;

// Weights, reps and sets are stored as typed, so they come back exactly.
const asTyped: Shown = String;
const asCalories: Shown = formatCalories;
const asGrams: Shown = formatGrams;
const asAmount: Shown = value => String(roundedAmount(value));

function textOf(value: number | null, show: Shown): string {
  return value === null ? '' : show(value);
}

// A box's number: the stored one while the box still shows it as it opened;
// otherwise what's typed, null when blank and NaN when it isn't a number. A
// comma works as the decimal point too, as some keyboards type one.
function numberIn(text: string, show: Shown, opened?: number | null): number | null {
  if (opened !== undefined && text === textOf(opened, show)) return opened;
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : Number.NaN;
}

// The same for a box already checked as filled.
function filledNumberIn(text: string, show: Shown, opened?: number | null): number {
  return numberIn(text, show, opened) ?? Number.NaN;
}

// Sets

export type SetBoxes = { weight: string; reps: string };
type StoredSet = Pick<SetValues, 'weight' | 'reps'>;

// A logged Set's boxes, for correcting it, or a planned Set's, for confirming
// it.
export function setBoxesOf(set: StoredSet): SetBoxes {
  return { weight: textOf(set.weight, asTyped), reps: textOf(set.reps, asTyped) };
}

// Reps must be filled, and so must the weight of a weighted Exercise. A
// bodyweight one's blank added weight is plain bodyweight.
export function readSet(
  trackingType: TrackingType,
  boxes: SetBoxes,
  isWarmUp: boolean,
  opened?: StoredSet,
): Reading<SetValues> {
  if (isBlank(boxes.reps)) return notReady;
  if (trackingType === 'weighted' && isBlank(boxes.weight)) return notReady;
  const values = {
    weight: numberIn(boxes.weight, asTyped, opened?.weight),
    reps: filledNumberIn(boxes.reps, asTyped, opened?.reps),
    isWarmUp,
  };
  return judged(values, problemWithSet(trackingType, values));
}

// Targets

export type TargetBoxes = { sets: string; minReps: string; maxReps: string; weight: string };
type StoredTarget = Omit<TargetValues, 'weightUnit'>;

export function targetBoxesOf(target: StoredTarget): TargetBoxes {
  return {
    sets: textOf(target.sets, asTyped),
    minReps: textOf(target.minReps, asTyped),
    maxReps: textOf(target.maxReps, asTyped),
    weight: textOf(target.weight, asTyped),
  };
}

// Sets and both ends of the rep range must be filled, and so must the weight
// for a weighted Exercise. The unit is picked, not typed.
export function readTarget(
  trackingType: TrackingType,
  boxes: TargetBoxes,
  weightUnit: WeightUnit,
  opened?: StoredTarget,
): Reading<TargetValues> {
  if (isBlank(boxes.sets) || isBlank(boxes.minReps) || isBlank(boxes.maxReps)) return notReady;
  if (trackingType === 'weighted' && isBlank(boxes.weight)) return notReady;
  const values = {
    sets: filledNumberIn(boxes.sets, asTyped, opened?.sets),
    minReps: filledNumberIn(boxes.minReps, asTyped, opened?.minReps),
    maxReps: filledNumberIn(boxes.maxReps, asTyped, opened?.maxReps),
    weight: numberIn(boxes.weight, asTyped, opened?.weight),
    weightUnit,
  };
  return judged(values, problemWithTarget(trackingType, values));
}

// Food items and Saved foods

export type FoodBoxes = Record<keyof FoodValues, string>;

export function foodBoxesOf(food: FoodValues): FoodBoxes {
  return {
    name: food.name,
    amount: textOf(food.amount, asAmount),
    unit: food.unit,
    calories: textOf(food.calories, asCalories),
    protein: textOf(food.protein, asGrams),
    carbs: textOf(food.carbs, asGrams),
    fat: textOf(food.fat, asGrams),
  };
}

function macrosIn(boxes: FoodBoxes, opened?: FoodValues) {
  return {
    protein: numberIn(boxes.protein, asGrams, opened?.protein) ?? 0,
    carbs: numberIn(boxes.carbs, asGrams, opened?.carbs) ?? 0,
    fat: numberIn(boxes.fat, asGrams, opened?.fat) ?? 0,
  };
}

// The name, amount and unit must be filled. `problemOf` is the core's rule for
// the kind of food: a Food item's or a Saved food's.
export function readFood(
  boxes: FoodBoxes,
  problemOf: (values: FoodValues) => string | undefined,
  opened?: FoodValues,
): Reading<FoodValues> {
  if (isBlank(boxes.name) || isBlank(boxes.amount) || isBlank(boxes.unit)) return notReady;
  const values = {
    name: boxes.name,
    amount: filledNumberIn(boxes.amount, asAmount, opened?.amount),
    unit: boxes.unit,
    calories: numberIn(boxes.calories, asCalories, opened?.calories),
    ...macrosIn(boxes, opened),
  };
  return judged(values, problemOf(values));
}

// What blank calories would be worked out as, from the macro boxes, to show
// in the calories box: undefined while a macro box isn't a number.
export function caloriesWorkedOut(boxes: FoodBoxes, opened?: FoodValues): number | undefined {
  const macros = macrosIn(boxes, opened);
  return Object.values(macros).every(Number.isFinite) ? caloriesFromMacros(macros) : undefined;
}

// Portions of a Saved food

// The amount box's text for an amount of a Saved food, in its Serving unit.
export function portionBoxOf(amount: number): string {
  return asAmount(amount);
}

// The amount must be filled. It opens at one Serving.
export function readPortion(savedFood: SavedFood, text: string): Reading<number> {
  if (isBlank(text)) return notReady;
  const quantity = filledNumberIn(text, asAmount, savedFood.servingAmount);
  return judged(quantity, problemWithPortion(savedFood, quantity));
}

// Macro targets

export type MacroTargetBoxes = Record<keyof MacroTargets, string>;

export function macroTargetBoxesOf(targets: MacroTargets): MacroTargetBoxes {
  return {
    calories: textOf(targets.calories, asCalories),
    protein: textOf(targets.protein, asGrams),
    carbs: textOf(targets.carbs, asGrams),
    fat: textOf(targets.fat, asGrams),
  };
}

// None must be filled: a blank one is no target.
export function readMacroTargets(
  boxes: MacroTargetBoxes,
  opened?: MacroTargets,
): Reading<MacroTargets> {
  const targets = {
    calories: numberIn(boxes.calories, asCalories, opened?.calories),
    protein: numberIn(boxes.protein, asGrams, opened?.protein),
    carbs: numberIn(boxes.carbs, asGrams, opened?.carbs),
    fat: numberIn(boxes.fat, asGrams, opened?.fat),
  };
  return judged(targets, problemWithMacroTargets(targets));
}

// Weigh-ins

// The weight must be filled.
export function readWeighIn(text: string): Reading<number> {
  if (isBlank(text)) return notReady;
  const weight = filledNumberIn(text, asTyped);
  return judged(weight, problemWithWeighIn(weight));
}
