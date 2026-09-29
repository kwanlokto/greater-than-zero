import { sql } from 'drizzle-orm';

import journal from '../../drizzle/meta/_journal.json';
import { createTestDatabase } from './test-database';
import { clockAt, startWorkoutWith } from './test-helpers';
import { createTracker, type BackupFile, type Tracker } from './tracker';

// The Backup file exported now, read back.
async function exportedBackup(tracker: Tracker): Promise<BackupFile> {
  return JSON.parse(await tracker.exportBackup('1.2.3'));
}

// The tables the migrations created, leaving out SQLite's own and the one
// recording which migrations have run. Read from the database itself, rather
// than the schema the export goes by, so a table the export misses however it
// comes about is caught.
function tablesIn(db: ReturnType<typeof createTestDatabase>): string[] {
  return db
    .all<{ name: string }>(
      sql`SELECT name FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    .map(({ name }) => name);
}

describe('Backup export', () => {
  it('records the format version, the app version and when it was exported', async () => {
    const tracker = createTracker(createTestDatabase(), clockAt('2026-09-29T18:30:00-04:00'));

    const backup = await exportedBackup(tracker);

    expect(backup).toMatchObject({
      formatVersion: 1,
      appVersion: '1.2.3',
      exportedAt: '2026-09-29T22:30:00.000Z',
    });
  });

  it('holds every table in the database, so tables added later are included too', async () => {
    const db = createTestDatabase();
    const tracker = createTracker(db);

    const backup = await exportedBackup(tracker);

    expect(tablesIn(db)).not.toHaveLength(0);
    expect(Object.keys(backup.tables).sort()).toEqual(tablesIn(db).sort());
  });

  it('records the schema version: how many migrations had shaped the tables', async () => {
    const tracker = createTracker(createTestDatabase());

    const backup = await exportedBackup(tracker);

    expect(backup.schemaVersion).toBe(journal.entries.length);
  });

  it('holds every row with its columns and values as stored, soft-deleted ones included', async () => {
    const clock = clockAt('2026-09-29T18:00:00-04:00');
    const tracker = createTracker(createTestDatabase(), clock);
    await tracker.setDisplayUnit('lb');
    const hidden = await tracker.createExercise({
      name: 'Landmine Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.hideExercise(hidden.id);
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 135, reps: 8, isWarmUp: true });
    await tracker.logSet(entry.id, { weight: 185, reps: 5 });
    const [warmUp] = (await tracker.getWorkout(workout.id))?.entries[0].sets ?? [];
    await tracker.deleteSet(warmUp.id);

    const { tables } = await exportedBackup(tracker);

    const at = new Date('2026-09-29T18:00:00-04:00').getTime();
    expect(tables.settings).toEqual([expect.objectContaining({ display_unit: 'lb' })]);
    expect(tables.exercises).toContainEqual(
      expect.objectContaining({
        id: hidden.id,
        name: 'Landmine Press',
        tracking_type: 'weighted',
        muscle_group: 'shoulders',
        is_custom: 1,
        deleted_at: at,
      }),
    );
    expect(tables.workouts).toEqual([
      expect.objectContaining({ id: workout.id, local_date: '2026-09-29', started_at: at }),
    ]);
    expect(
      tables.sets.map(({ weight, weight_unit, reps, is_warm_up, deleted_at }) => [
        weight,
        weight_unit,
        reps,
        is_warm_up,
        deleted_at,
      ]),
    ).toEqual([
      [135, 'lb', 8, 1, at],
      [185, 'lb', 5, 0, null],
    ]);
  });
});
