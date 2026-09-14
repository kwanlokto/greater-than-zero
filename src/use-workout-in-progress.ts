import { tracker } from '@/database';
import { useTrackerQuery } from '@/use-tracker-query';

// The Workout in progress, kept current as it changes. Undefined until it
// loads, then null while there isn't one.
export function useWorkoutInProgress() {
  return useTrackerQuery(() => tracker.getWorkoutInProgress(), []);
}
