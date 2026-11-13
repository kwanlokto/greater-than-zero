// Where database changes come from: expo-sqlite's change events on the phone,
// a hand-driven source in tests.
export type ChangeSource = (listener: () => void) => { remove(): void };

// Runs a tracker query, then runs it again whenever the database changes,
// handing each result to `onResult`. Returns a function that stops it. Only the
// latest run hands over its result, so a slow earlier run can't overwrite a
// newer one, and nothing arrives after stopping.
export function watchQuery<T>(
  query: () => Promise<T>,
  onResult: (value: T) => void,
  onChange: ChangeSource,
): () => void {
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
  const subscription = onChange(() => {
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
