// Weights: converting between units, rounding for display, comparing, and
// reading them out. A weight is kept as it was entered, in its own unit;
// everything shown or compared is worked out from that here.

import type { TrackingType, WeightUnit } from './schema';

// A weight to show, in the unit it's shown in.
export type Weight = {
  value: number;
  unit: WeightUnit;
};

// A weight as entered, in its own unit. Null is plain bodyweight: no added
// weight.
export type EnteredWeight = {
  weight: number | null;
  weightUnit: WeightUnit;
};

const kilogramsPerPound = 0.45359237;

// Weights in different units closer than this, in kilograms, are the same
// weight: a Set entered in kilograms against a Target in pounds rarely converts
// exactly (135 lb is 61.235 kg, loaded as 61.25), and no plate is this small.
const sameWeightTolerance = 0.05;

// A weight in another unit, at full precision.
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  return from === 'lb' ? weight * kilogramsPerPound : weight / kilogramsPerPound;
}

// A weight as shown: to one decimal place, halves away from zero, so help from
// an assisted machine rounds the same way as added weight.
export function roundedForDisplay(weight: number): number {
  const tenths = Math.round(Math.abs(weight) * 10) / 10;
  return weight < 0 ? -tenths : tenths;
}

// What to show for a weight entered in `unit`: in the display unit, rounded.
// Records keep the value and unit as entered.
export function displayedWeight(weight: number, unit: WeightUnit, displayUnit: WeightUnit): Weight {
  return { value: roundedForDisplay(convertWeight(weight, unit, displayUnit)), unit: displayUnit };
}

// The same, for a weight that may be blank: null for plain bodyweight.
export function displayWeightOf(
  weight: number | null,
  unit: WeightUnit,
  displayUnit: WeightUnit,
): Weight | null {
  return weight === null ? null : displayedWeight(weight, unit, displayUnit);
}

// For comparing weights entered in either unit. Plain bodyweight is no added
// weight.
export function kilogramsOf({ weight, weightUnit }: EnteredWeight): number {
  return convertWeight(weight ?? 0, weightUnit, 'kg');
}

// Weights in one unit compare exactly; across units, allowing for conversion
// (sameWeightTolerance). Plain bodyweight is no added weight.
export function isHeavier(weight: EnteredWeight, than: EnteredWeight): boolean {
  if (weight.weightUnit === than.weightUnit) return (weight.weight ?? 0) > (than.weight ?? 0);
  return kilogramsOf(weight) - kilogramsOf(than) >= sameWeightTolerance;
}

export function isAtLeast(weight: EnteredWeight, than: EnteredWeight): boolean {
  return !isHeavier(than, weight);
}

export function lightestOf<W extends EnteredWeight>(weighed: W[]): W {
  return weighed.reduce((lightestSoFar, next) =>
    kilogramsOf(next) < kilogramsOf(lightestSoFar) ? next : lightestSoFar,
  );
}

// "82.4 kg", or "−20 kg" for help from an assisted machine.
export function formatWeight({ value, unit }: Weight): string {
  return `${value < 0 ? '−' : ''}${Math.abs(value)} ${unit}`;
}

// The load of a Set or Target in words, in the display unit: "60 kg", or for a
// bodyweight Exercise "bodyweight", "bodyweight + 10 kg" or "bodyweight − 20 kg".
// No added weight, whether left blank or entered as 0, is plain bodyweight:
// judged on the weight as entered, not the rounded one shown.
export function describeLoad(
  trackingType: TrackingType,
  { weight, displayWeight }: { weight: number | null; displayWeight: Weight | null },
): string {
  if (trackingType === 'weighted') return displayWeight ? formatWeight(displayWeight) : '';
  if (!weight || !displayWeight) return 'bodyweight';
  const { value, unit } = displayWeight;
  return `bodyweight ${value < 0 ? '−' : '+'} ${Math.abs(value)} ${unit}`;
}

// A Set in words: "60 kg × 8", "Bodyweight × 10" or "Bodyweight + 10 kg × 6".
export function describeSet(
  trackingType: TrackingType,
  set: { weight: number | null; displayWeight: Weight | null; reps: number },
): string {
  const load = describeLoad(trackingType, set);
  return `${load.charAt(0).toUpperCase()}${load.slice(1)} × ${set.reps}`;
}
