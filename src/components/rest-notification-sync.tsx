import { useEffect } from 'react';

import { tracker } from '@/database';
import { scheduleRestEnd } from '@/notifications';
import { useTrackerQuery } from '@/use-tracker-query';

// Keeps the rest-end notification in step with the Workout in progress:
// scheduled for the rest's end, moved with it, and cancelled when the rest is
// cleared by finishing or discarding. Lives at the root so it works whatever
// screen is open. Renders nothing.
export function RestNotificationSync() {
  const workout = useTrackerQuery(() => tracker.getWorkoutInProgress(), []);
  const loaded = workout !== undefined;
  const restEndsAt = workout?.restEndsAt?.getTime() ?? null;

  useEffect(() => {
    if (!loaded) return;
    scheduleRestEnd(restEndsAt === null ? null : new Date(restEndsAt));
  }, [loaded, restEndsAt]);

  return null;
}
