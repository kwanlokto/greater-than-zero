import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

// Runs a tracker query, then runs it again whenever the database changes, so a
// screen stays current when data changes elsewhere. Undefined until it loads.
export function useTrackerQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [result, setResult] = useState<T>();

  useEffect(() => {
    // Ignore results from a query whose inputs have since changed.
    let current = true;
    const run = () => {
      query().then(value => {
        if (current) setResult(value);
      });
    };
    run();
    const subscription = addDatabaseChangeListener(run);
    return () => {
      current = false;
      subscription.remove();
    };
  }, deps);

  return result;
}
