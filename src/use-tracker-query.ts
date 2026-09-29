import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

// Runs a tracker query, then runs it again whenever the database changes, so a
// screen stays current when data changes elsewhere. Undefined until it loads.
export function useTrackerQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [result, setResult] = useState<T>();

  useEffect(() => {
    // Only the latest run may set the result, so a slow earlier run can't
    // overwrite a newer one, and nothing lands after the inputs change.
    let latestRun = 0;
    let active = true;
    const run = () => {
      const thisRun = ++latestRun;
      query().then(value => {
        if (active && thisRun === latestRun) setResult(value);
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
  }, deps);

  return result;
}
