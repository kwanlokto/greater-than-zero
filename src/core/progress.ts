// How an Exercise has progressed: one value per finished Workout.

import type { TrackingType, WeightUnit } from './schema';

// What a progress chart measures in each Workout's working Sets of an
// Exercise: the best estimated one-rep max, the heaviest weight (for a
// bodyweight Exercise, its added weight), or the most reps.
export type ProgressMeasure = 'estimatedOneRepMax' | 'heaviestWeight' | 'mostReps';

// The two a chart offers for each kind of Exercise: the one it shows first,
// and the one it switches to.
export const progressMeasuresFor: Record<TrackingType, [ProgressMeasure, ProgressMeasure]> = {
  weighted: ['estimatedOneRepMax', 'heaviestWeight'],
  bodyweight: ['mostReps', 'heaviestWeight'],
};

// A finished Workout on a progress chart.
export type ProgressPoint = {
  workoutId: string;
  // Its local date, as YYYY-MM-DD.
  localDate: string;
  // At full precision, for plotting.
  value: number;
  // What to show: a weight to one decimal place, like a Set's, or reps.
  displayValue: number;
};

// A progress chart: its points in the order Workouts go in, and the unit of
// their values: the display unit for weights, or reps.
export type ProgressSeries = {
  unit: WeightUnit | 'reps';
  points: ProgressPoint[];
};

// Epley's estimate of the most that could be lifted once: weight × (1 + reps ÷
// 30). A Set of 1 rep is its own weight.
export function estimatedOneRepMax(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// What a measure's values are in: reps, or weights in the display unit.
export function unitOf(measure: ProgressMeasure, displayUnit: WeightUnit): ProgressSeries['unit'] {
  return measure === 'mostReps' ? 'reps' : displayUnit;
}

// A Workout's value for a measure: the best of its working Sets of the
// Exercise, each weight in the unit charted. Plain bodyweight, stored as null,
// is no added weight.
export function bestValueOf(
  measure: ProgressMeasure,
  workingSets: { weight: number | null; reps: number }[],
): number {
  const values = workingSets.map(({ weight, reps }) => {
    if (measure === 'estimatedOneRepMax') return estimatedOneRepMax(weight ?? 0, reps);
    if (measure === 'heaviestWeight') return weight ?? 0;
    return reps;
  });
  return Math.max(...values);
}
