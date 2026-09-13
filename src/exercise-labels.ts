import type { Exercise, MuscleGroup, TrackingType } from '@/core/tracker';

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

export const trackingTypeLabels: Record<TrackingType, string> = {
  weighted: 'Weighted',
  bodyweight: 'Bodyweight',
};

// "Chest · Weighted", the line under an Exercise's name.
export function exerciseDetails(exercise: Pick<Exercise, 'muscleGroup' | 'trackingType'>): string {
  return `${muscleGroupLabels[exercise.muscleGroup]} · ${trackingTypeLabels[exercise.trackingType]}`;
}
