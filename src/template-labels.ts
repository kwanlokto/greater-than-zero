import type { Target, TrackingType } from '@/core/tracker';

// "3 × 8–12 @ 60 kg", or "3 × 5 @ 100 kg" when the rep range is one number.
// The weight is in the display unit, whatever unit the Target was entered in.
export function describeTarget(trackingType: TrackingType, target: Target): string {
  const { sets, minReps, maxReps } = target;
  const reps = minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  return `${sets} × ${reps} @ ${describeTargetWeight(trackingType, target)}`;
}

function describeTargetWeight(trackingType: TrackingType, { weight, displayWeight }: Target) {
  if (trackingType === 'weighted') {
    return displayWeight ? `${displayWeight.value} ${displayWeight.unit}` : '';
  }
  // No added weight, whether left blank or entered as 0, is plain bodyweight.
  if (!weight || !displayWeight) return 'bodyweight';
  const { value, unit } = displayWeight;
  return `bodyweight ${value < 0 ? '−' : '+'} ${Math.abs(value)} ${unit}`;
}

// "3 exercises", under a Template's name.
export function exerciseCount(count: number): string {
  return count === 1 ? '1 exercise' : `${count} exercises`;
}
