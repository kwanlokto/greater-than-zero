import { createTestDatabase } from './test-database';
import { createTracker } from './tracker';

describe('display unit', () => {
  it('is kg on a fresh install, before the lifter chooses', async () => {
    const tracker = createTracker(createTestDatabase());

    expect(await tracker.getDisplayUnit()).toBe('kg');
  });

  it('reads back lb after the lifter chooses lb', async () => {
    const tracker = createTracker(createTestDatabase());

    await tracker.setDisplayUnit('lb');

    expect(await tracker.getDisplayUnit()).toBe('lb');
  });

  it('follows the latest choice when the lifter changes it in Settings', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');

    await tracker.setDisplayUnit('kg');

    expect(await tracker.getDisplayUnit()).toBe('kg');
  });
});
