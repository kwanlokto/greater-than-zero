import type { Target, Template, TrackingType, Weight } from '@/core/tracker';

// "3 × 8–12 @ 60 kg", or "3 × 5 @ 100 kg" when the rep range is one number.
// The weight is in the display unit, whatever unit the Target was entered in.
export function describeTarget(trackingType: TrackingType, target: Target): string {
  const { sets, minReps, maxReps } = target;
  const reps = minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  return `${sets} × ${reps} @ ${describeTargetWeight(trackingType, target)}`;
}

// "60 kg", or for a bodyweight Exercise "bodyweight + 10 kg", in the display
// unit. For a Target's weight, or one proposed for it.
export function describeTargetWeight(
  trackingType: TrackingType,
  { weight, displayWeight }: { weight: number | null; displayWeight: Weight | null },
) {
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

// "Bench Press, Dip", under a Template's name where there's room for them.
export function exerciseList({ exercises }: Template): string {
  if (exercises.length === 0) return exerciseCount(0);
  return exercises.map(({ exercise }) => exercise.name).join(', ');
}
