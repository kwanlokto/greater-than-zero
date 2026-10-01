import type { ProgressMeasure, ProgressSeries, TrackingType } from '@/core/tracker';

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
