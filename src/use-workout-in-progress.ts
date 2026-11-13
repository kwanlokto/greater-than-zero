import { tracker } from '@/database';
import { sharedTrackerQuery } from '@/use-tracker-query';

// The Workout in progress, kept current as it changes, with each entry as it's
// logged. Undefined until it loads, then null while there isn't one. The
// Workout bar, Today, the day view, the rest notification and the Workout
// screen all show it, so they share one copy, worked out once per change.
export const useWorkoutInProgress = sharedTrackerQuery(() => tracker.getWorkoutInProgress());
