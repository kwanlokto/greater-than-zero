import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState, useSyncExternalStore, type DependencyList } from 'react';

import { watchQuery } from '@/watch-query';

// Runs a tracker query, then runs it again whenever the database changes, so a
// screen stays current when data changes elsewhere. Undefined until it loads.
export function useTrackerQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [result, setResult] = useState<T>();

  useEffect(
    () => watchQuery(query, value => setResult(() => value), addDatabaseChangeListener),
    deps,
  );

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
      stop = watchQuery(
        query,
        value => {
          current = value;
          listeners.forEach(notify => notify());
        },
        addDatabaseChangeListener,
      );
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
