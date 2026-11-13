import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState, useSyncExternalStore, type DependencyList } from 'react';

// Runs a tracker query, then runs it again whenever the database changes,
// handing each result to `onResult`. Returns a function that stops it. Only
// the latest run hands over its result, so a slow earlier run can't overwrite
// a newer one, and nothing arrives after stopping.
function watchQuery<T>(query: () => Promise<T>, onResult: (value: T) => void): () => void {
  let latestRun = 0;
  let active = true;
  const run = () => {
    const thisRun = ++latestRun;
    query().then(value => {
      if (active && thisRun === latestRun) onResult(value);
    });
  };
  run();
  // A change comes as one event per row, so a big one, like importing a
  // Backup file, is a burst of thousands: they're gathered into one run.
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const subscription = addDatabaseChangeListener(() => {
    scheduled ??= setTimeout(() => {
      scheduled = undefined;
      run();
    }, 0);
  });
  return () => {
    active = false;
    clearTimeout(scheduled);
    subscription.remove();
  };
}

// Runs a tracker query, then runs it again whenever the database changes, so a
// screen stays current when data changes elsewhere. Undefined until it loads.
export function useTrackerQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [result, setResult] = useState<T>();

  useEffect(() => watchQuery(query, value => setResult(() => value)), deps);

  return result;
}

// A tracker query every screen showing it shares, as a hook: it runs once per
// database change however many screens are mounted, rather than once for each.
// Undefined until it loads.
export function sharedTrackerQuery<T>(query: () => Promise<T>): () => T | undefined {
  let current: T | undefined;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
      stop = watchQuery(query, value => {
        current = value;
        listeners.forEach(notify => notify());
      });
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      stop?.();
      stop = undefined;
      // The next screen to show it loads it afresh.
      current = undefined;
    };
  }

  return function useSharedTrackerQuery() {
    return useSyncExternalStore(subscribe, () => current);
  };
}
