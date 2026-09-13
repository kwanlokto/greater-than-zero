import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { tracker } from '@/database';

// Reopens a Workout left in progress when the app launches, e.g. after the
// app was killed or the phone restarted mid-Workout. Returns true once that
// check is done, so the splash screen can stay up until then.
export function useResumeWorkoutOnLaunch(enabled: boolean): boolean {
  const router = useRouter();
  // Navigating before the root navigator is ready throws.
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const checked = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled || !navigationReady || checked.current) return;
    checked.current = true;
    (async () => {
      try {
        if (await tracker.getWorkoutInProgress()) router.push('/workout');
      } finally {
        setDone(true);
      }
    })();
  }, [enabled, navigationReady, router]);

  return done;
}
