import { useEffect } from 'react';

import { phoneNotifier } from '@/phone-notifier';
import { createRestEndNotification } from '@/rest-end-notification';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

const restEndNotification = createRestEndNotification(phoneNotifier);

// Feeds the Workout in progress to the rest-end notification, from the root so
// it works whatever screen is open. Renders nothing.
export function RestNotificationSync() {
  const workout = useWorkoutInProgress();
  const loaded = workout !== undefined;
  const hasWorkout = Boolean(workout);
  const restEndTime = workout?.restEndsAt?.getTime() ?? null;

  useEffect(() => {
    if (!loaded) return;
    const restEndsAt = restEndTime === null ? null : new Date(restEndTime);
    void restEndNotification.follow(hasWorkout ? { restEndsAt } : null);
  }, [loaded, hasWorkout, restEndTime]);

  return null;
}
