import { sql } from 'drizzle-orm';

import { createTestDatabaseBefore, migrateToLatest } from './test-database';
import { clockAt, doWorkout } from './test-helpers';
import { createTracker } from './tracker';

// Migrations run at launch on a phone that already has data, so each one that
// changes existing tables is tried on a database from before it.
describe('Migrations', () => {
  it('drop Exercise notes, keeping every Exercise entry and its Sets', async () => {
    const db = createTestDatabaseBefore('0018_drop_exercise_entries_notes');
    const tracker = createTracker(db, clockAt('2026-09-28T18:00:00-04:00'));
    await doWorkout(tracker, 'Bench Press', [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 8 },
    ]);
    db.run(sql`UPDATE exercise_entries SET notes = 'Pause at the bottom'`);
    const before = await tracker.getDay('2026-09-28');

    migrateToLatest(db);

    const columns = db.all<{ name: string }>(sql`PRAGMA table_info(exercise_entries)`);
    expect(columns.map(({ name }) => name)).not.toContain('notes');
    expect(db.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
    expect(await tracker.getDay('2026-09-28')).toEqual(before);
    expect(before.workouts[0].entries[0].sets).toHaveLength(2);
  });
});
