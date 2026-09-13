import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { tracker } from '@/database';

// Reopens a Workout left in progress when the app launches, e.g. after the
// app was killed or the phone restarted mid-Workout. Returns true once the
// check has run and any navigation has been issued.
export function useResumeWorkoutOnLaunch(enabled: boolean): boolean {
  const router = useRouter();
  const checkStarted = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The root layout mounts its Stack in the same render that enables this,
    // and effects run after that render, so there's a navigator to go to.
    if (!enabled || checkStarted.current) return;
    checkStarted.current = true;
    tracker
      .getWorkoutInProgress()
      .then(workout => {
        if (workout) router.navigate('/workout');
      })
      // The lifter then lands on Today, where the Workout bar still leads back.
      .catch(error => console.warn('Could not check for a Workout in progress', error))
      .finally(() => setDone(true));
  }, [enabled, router]);

  return done;
}
