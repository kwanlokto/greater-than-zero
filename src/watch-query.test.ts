import { watchQuery, type ChangeSource } from './watch-query';

// Database changes the test makes by hand.
function changes() {
  const listeners = new Set<() => void>();
  const onChange: ChangeSource = listener => {
    listeners.add(listener);
    return { remove: () => void listeners.delete(listener) };
  };
  return { onChange, change: () => listeners.forEach(listener => listener()), listeners };
}

// A query whose runs each finish when the test says, with the value it gives.
function heldQuery() {
  const runs: ((value: number) => void)[] = [];
  const query = () => new Promise<number>(resolve => runs.push(resolve));
  return { query, runs };
}

// Lets scheduled runs start and finished runs hand over their results.
async function settle() {
  await jest.runAllTimersAsync();
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Watching a query', () => {
  it('runs it at once, then once more for a burst of changes', async () => {
    const source = changes();
    let runs = 0;
    const results: number[] = [];

    watchQuery(
      async () => ++runs,
      value => results.push(value),
      source.onChange,
    );
    await settle();
    expect(results).toEqual([1]);

    // Importing a Backup file changes thousands of rows at once.
    for (let row = 0; row < 1000; row++) source.change();
    await settle();
    expect(runs).toBe(2);
    expect(results).toEqual([1, 2]);
  });

  it('ignores an earlier run that finishes after a later one', async () => {
    const source = changes();
    const { query, runs } = heldQuery();
    const results: number[] = [];

    watchQuery(query, value => results.push(value), source.onChange);
    source.change();
    await settle();
    expect(runs).toHaveLength(2);
    runs[1](2);
    runs[0](1);
    await settle();

    expect(results).toEqual([2]);
  });

  it('hands over nothing more, and stops listening, once stopped', async () => {
    const source = changes();
    const { query, runs } = heldQuery();
    const results: number[] = [];

    const stop = watchQuery(query, value => results.push(value), source.onChange);
    source.change();
    stop();
    await settle();
    runs.forEach(finish => finish(1));
    await settle();

    expect(results).toEqual([]);
    // The run the change scheduled never started.
    expect(runs).toHaveLength(1);
    expect(source.listeners.size).toBe(0);
  });
});
