import type { ProgressMeasure, ProgressPoint, ProgressSeries, TrackingType } from '@/core/tracker';
import { formatLocalDate } from '@/dates';

// What each measure is called on a progress chart, for each kind of Exercise.
export const measureNames: Record<TrackingType, Record<ProgressMeasure, string>> = {
  weighted: {
    estimatedOneRepMax: 'Estimated 1-rep max',
    heaviestWeight: 'Heaviest weight',
    mostReps: 'Most reps',
  },
  bodyweight: {
    estimatedOneRepMax: 'Estimated 1-rep max',
    heaviestWeight: 'Heaviest added weight',
    mostReps: 'Most reps',
  },
};

// "116.7 kg", "−20 kg" (help from an assisted machine) or "12 reps": a value on
// a progress chart as the core gives it to show.
export function formatProgressValue(unit: ProgressSeries['unit'], displayValue: number): string {
  if (unit === 'reps') return displayValue === 1 ? '1 rep' : `${displayValue} reps`;
  return `${displayValue < 0 ? '−' : ''}${Math.abs(displayValue)} ${unit}`;
}

// "Estimated 1-rep max over 3 workouts, from 116.7 kg on 20 Sep to 130 kg on
// 24 Sep": a progress chart in words, for screen readers.
export function describeProgress(name: string, { unit, points }: ProgressSeries): string {
  const first = points[0];
  const last = points[points.length - 1];
  const workouts = points.length === 1 ? '1 workout' : `${points.length} workouts`;
  const valueOn = (point: ProgressPoint) =>
    `${formatProgressValue(unit, point.displayValue)} on ${formatLocalDate(point.localDate)}`;
  return `${name} over ${workouts}, from ${valueOn(first)} to ${valueOn(last)}`;
}
