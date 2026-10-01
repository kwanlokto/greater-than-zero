// The lifter's body weight: one Weigh-in a day, and its trend.

import type { WeightUnit } from './schema';

// A weight in a unit, as shown.
type Weight = { value: number; unit: WeightUnit };

// The lifter's body weight on a day.
export type WeighIn = {
  // The phone's local calendar date it's for, as YYYY-MM-DD.
  localDate: string;
  // As entered, in weightUnit.
  weight: number;
  weightUnit: WeightUnit;
  // What to show: in the display unit, to one decimal place.
  displayWeight: Weight;
  // When it was entered, or last replaced.
  weighedAt: Date;
};

// Why a Weigh-in can't be recorded with this weight, or undefined when it can.
// setWeighIn enforces it; screens use it to decide when to allow saving.
export function problemWithWeighIn(weight: number): string | undefined {
  if (Number.isFinite(weight) && weight > 0) return undefined;
  return 'A Weigh-in needs a weight above 0';
}

// A Weigh-in on the body-weight trend.
export type TrendPoint = {
  localDate: string;
  // In the display unit, at full precision, for plotting.
  value: number;
  // What to show: to one decimal place, like the Weigh-in itself.
  displayValue: number;
};

// Every Weigh-in by date, in the display unit.
export type BodyWeightTrend = {
  unit: WeightUnit;
  points: TrendPoint[];
};
