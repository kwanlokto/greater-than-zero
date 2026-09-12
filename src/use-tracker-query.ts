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
    const subscription = addDatabaseChangeListener(run);
    return () => {
      active = false;
      subscription.remove();
    };
  }, deps);

  return result;
}
