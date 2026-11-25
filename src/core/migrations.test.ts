import { sql } from 'drizzle-orm';

import { createTestDatabaseBefore, migrateToLatest } from './test-database';
import { createTracker } from './tracker';

type OldDatabase = ReturnType<typeof createTestDatabaseBefore>;

// Migrations run at launch on a phone that already has data, so each one that
// changes existing tables is tried on a database from before it. The data from
// before goes in as SQL, since the tracker only knows today's tables; what the
// lifter has afterwards is read through the tracker.

// A finished Workout of Bench Press on 2026-09-28, two Sets, as a database
// before `0018` held it.
function addBenchWorkout(db: OldDatabase) {
  db.run(sql`INSERT INTO workouts (id, local_date, started_at, finished_at)
             VALUES ('workout-1', '2026-09-28', 1790636400000, 1790640000000)`);
  db.run(sql`INSERT INTO exercise_entries (id, workout_id, exercise_id, position)
             SELECT 'entry-1', 'workout-1', id, 0 FROM exercises WHERE name = 'Bench Press'`);
  db.run(sql`INSERT INTO sets (id, exercise_entry_id, position, weight, weight_unit, reps, logged_at)
             VALUES ('set-1', 'entry-1', 0, 60, 'kg', 10, 1790636500000),
                    ('set-2', 'entry-1', 1, 60, 'kg', 8, 1790636700000)`);
}

function columnsOf(db: OldDatabase, table: string) {
  return db
    .all<{ name: string }>(sql`SELECT name FROM pragma_table_info(${table})`)
    .map(({ name }) => name);
}

describe('Migrations', () => {
  it('drop Exercise notes, keeping every Exercise entry and its Sets', async () => {
    const db = createTestDatabaseBefore('0018_drop_exercise_entries_notes');
    addBenchWorkout(db);
    db.run(sql`UPDATE exercise_entries SET notes = 'Pause at the bottom'`);

    migrateToLatest(db);

    expect(columnsOf(db, 'exercise_entries')).not.toContain('notes');
    expect(db.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
    const { workouts } = await createTracker(db).getDay('2026-09-28');
    expect(workouts.map(workout => workout.entries.map(entry => entry.exercise.name))).toEqual([
      ['Bench Press'],
    ]);
    expect(workouts[0].entries[0].sets.map(set => [set.weight, set.reps])).toEqual([
      [60, 10],
      [60, 8],
    ]);
  });

  it('give planned Sets a warm-up mark, leaving those already planned as working Sets', async () => {
    const db = createTestDatabaseBefore('0019_add_planned_sets_is_warm_up');
    db.run(sql`INSERT INTO workouts (id, local_date, started_at)
               VALUES ('workout-1', '2026-11-16', 1794870000000)`);
    db.run(sql`INSERT INTO exercise_entries (id, workout_id, exercise_id, position)
               SELECT 'entry-1', 'workout-1', id, 0 FROM exercises WHERE name = 'Bench Press'`);
    db.run(sql`INSERT INTO planned_sets (id, exercise_entry_id, position, weight, weight_unit, reps)
               VALUES ('planned-1', 'entry-1', 0, 60, 'kg', 8)`);

    migrateToLatest(db);

    const inProgress = await createTracker(db).getWorkoutInProgress();
    expect(inProgress?.entries[0].plannedSets).toEqual([
      { id: 'planned-1', weight: 60, weightUnit: 'kg', reps: 8, isWarmUp: false },
    ]);
  });
});
