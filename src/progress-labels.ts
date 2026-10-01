import type { ProgressMeasure, ProgressSeries, TrackingType } from '@/core/tracker';

// What a measure is called on a progress chart for a kind of Exercise.
export function measureName(trackingType: TrackingType, measure: ProgressMeasure): string {
  if (measure === 'estimatedOneRepMax') return 'Estimated 1-rep max';
  if (measure === 'mostReps') return 'Most reps';
  return trackingType === 'bodyweight' ? 'Heaviest added weight' : 'Heaviest weight';
}

// "116.7 kg", "−20 kg" (help from an assisted machine) or "12 reps": a value on
// a progress chart, weights to one decimal place.
export function formatProgressValue(unit: ProgressSeries['unit'], value: number): string {
  if (unit === 'reps') return value === 1 ? '1 rep' : `${value} reps`;
  const tenths = Math.round(Math.abs(value) * 10) / 10;
  return `${value < 0 && tenths > 0 ? '−' : ''}${tenths} ${unit}`;
}

// Every measure's name for a kind of Exercise, for picking between them.
export function measureNamesFor(trackingType: TrackingType): Record<ProgressMeasure, string> {
  return {
    estimatedOneRepMax: measureName(trackingType, 'estimatedOneRepMax'),
    heaviestWeight: measureName(trackingType, 'heaviestWeight'),
    mostReps: measureName(trackingType, 'mostReps'),
  };
}
