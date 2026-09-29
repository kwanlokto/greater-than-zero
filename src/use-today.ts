import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localDateOf } from '@/core/tracker';

// Today's local date, as YYYY-MM-DD, kept current for a screen left open: it
// moves on at midnight, and is checked again whenever the app comes back to
// the foreground, as timers wait while it's in the background.
export function useToday(): string {
  const [today, setToday] = useState(() => localDateOf(new Date()));

  useEffect(() => {
    const check = () => setToday(localDateOf(new Date()));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(check, midnight.getTime() - now.getTime());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
