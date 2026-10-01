import { createTestDatabase } from './test-database';
import { clockAt } from './test-helpers';
import { createTracker, problemWithWeighIn } from './tracker';

describe('Weigh-ins', () => {
  it("record today's weight as entered, in the display unit", async () => {
    const clock = clockAt('2026-09-29T07:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setDisplayUnit('lb');

    await tracker.setWeighIn(181.4);

    expect(await tracker.getWeighIn('2026-09-29')).toEqual({
      localDate: '2026-09-29',
      weight: 181.4,
      weightUnit: 'lb',
      displayWeight: { value: 181.4, unit: 'lb' },
      weighedAt: new Date('2026-09-29T07:30:00'),
    });
    expect(await tracker.getWeighIn('2026-09-28')).toBeNull();
  });

  it('are one per local date: entering another the same day replaces it, unit and all', async () => {
    const clock = clockAt('2026-09-28T23:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setWeighIn(82.4);
    clock.setTime('2026-09-29T07:30:00');
    await tracker.setWeighIn(82.1);
    clock.setTime('2026-09-29T08:15:00');
    await tracker.setDisplayUnit('lb');

    await tracker.setWeighIn(180.5);

    expect(await tracker.getWeighIn('2026-09-29')).toMatchObject({
      weight: 180.5,
      weightUnit: 'lb',
      weighedAt: new Date('2026-09-29T08:15:00'),
    });
    // The night before counts toward its own date, and stays as it was.
    expect(await tracker.getWeighIn('2026-09-28')).toMatchObject({
      weight: 82.4,
      weightUnit: 'kg',
      displayWeight: { value: 181.7, unit: 'lb' },
    });
    const { points } = await tracker.getBodyWeightTrend();
    expect(points.map(({ localDate, displayValue }) => [localDate, displayValue])).toEqual([
      ['2026-09-28', 181.7],
      ['2026-09-29', 180.5],
    ]);
  });

  it('come back on a date whose Weigh-in a Backup file had deleted', async () => {
    const clock = clockAt('2026-09-29T07:30:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setWeighIn(82.1);
    const backup = JSON.parse(await tracker.exportBackup('1.2.3'));
    backup.tables.weigh_ins[0].deleted_at = clock.now().getTime();
    await tracker.importBackup(JSON.stringify(backup));
    expect(await tracker.getWeighIn('2026-09-29')).toBeNull();
    expect((await tracker.getBodyWeightTrend()).points).toEqual([]);

    clock.setTime('2026-09-29T08:00:00');
    await tracker.setWeighIn(81.9);

    expect(await tracker.getWeighIn('2026-09-29')).toMatchObject({
      weight: 81.9,
      weighedAt: new Date('2026-09-29T08:00:00'),
    });
  });

  it.each([0, -80, Number.NaN])('need a weight above 0, not %s', async weight => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T07:30:00'));
    await tracker.setWeighIn(82.1);
    const problem = 'A Weigh-in needs a weight above 0';

    expect(problemWithWeighIn(82.1)).toBeUndefined();
    expect(problemWithWeighIn(weight)).toBe(problem);
    await expect(tracker.setWeighIn(weight)).rejects.toThrow(problem);
    expect((await tracker.getWeighIn('2026-09-29'))?.weight).toBe(82.1);
  });

  it("show in their day's History", async () => {
    const clock = clockAt('2026-09-28T07:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setWeighIn(82.4);

    expect((await tracker.getDay('2026-09-28')).weighIn?.weight).toBe(82.4);
    expect((await tracker.getDay('2026-09-29')).weighIn).toBeNull();
  });
});

describe('Body-weight trend', () => {
  it('charts every Weigh-in by date, converted from its unit to the display unit', async () => {
    const clock = clockAt('2026-09-27T07:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setWeighIn(82.4);
    await tracker.setDisplayUnit('lb');
    clock.setTime('2026-09-29T07:00:00');
    await tracker.setWeighIn(180);
    clock.setTime('2026-09-28T07:00:00');
    await tracker.setWeighIn(180.5);

    // [local date, value to three decimal places, value as shown]
    const trendIn = async (unit: 'kg' | 'lb') => {
      await tracker.setDisplayUnit(unit);
      const trend = await tracker.getBodyWeightTrend();
      return {
        unit: trend.unit,
        points: trend.points.map(point => [
          point.localDate,
          Math.round(point.value * 1000) / 1000,
          point.displayValue,
        ]),
      };
    };

    expect(await trendIn('kg')).toEqual({
      unit: 'kg',
      points: [
        ['2026-09-27', 82.4, 82.4],
        ['2026-09-28', 81.873, 81.9],
        ['2026-09-29', 81.647, 81.6],
      ],
    });
    expect(await trendIn('lb')).toEqual({
      unit: 'lb',
      points: [
        ['2026-09-27', 181.661, 181.7],
        ['2026-09-28', 180.5, 180.5],
        ['2026-09-29', 180, 180],
      ],
    });
  });

  it('is empty before the first Weigh-in', async () => {
    const tracker = createTracker(createTestDatabase());

    expect(await tracker.getBodyWeightTrend()).toEqual({ unit: 'kg', points: [] });
  });
});
