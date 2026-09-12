import type { MuscleGroup, TrackingType } from '@/core/tracker';

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
