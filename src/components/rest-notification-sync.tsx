import { useEffect } from 'react';

import {
  askForNotificationsOnce,
  setUpNotifications,
  syncRestEndNotification,
} from '@/notifications';
import { useWorkoutInProgress } from '@/use-workout-in-progress';

// Everything the rest-end notification needs, at the root so it works whatever
// screen is open: set up once, permission asked when the first Workout starts
// (however it was started), and the notification kept in step with the
// Workout in progress. It's scheduled for the rest's end, moved with it, and
// cancelled when finishing or discarding clears the rest. Renders nothing.
export function RestNotificationSync() {
  const workout = useWorkoutInProgress();
  const loaded = workout !== undefined;
  const hasWorkout = Boolean(workout);
  const restEndTime = workout?.restEndsAt?.getTime() ?? null;

  useEffect(() => {
    setUpNotifications();
  }, []);

  // Asked over the Workout. Declining leaves the in-app timer working.
  useEffect(() => {
    if (hasWorkout) askForNotificationsOnce();
  }, [hasWorkout]);

  useEffect(() => {
    if (!loaded) return;
    syncRestEndNotification(restEndTime === null ? null : new Date(restEndTime));
  }, [loaded, restEndTime]);

  return null;
}
