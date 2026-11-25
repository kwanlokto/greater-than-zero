import { sql } from 'drizzle-orm';

import { createTestDatabaseBefore, migrateToLatest } from './test-database';
import { findExerciseByName } from './test-helpers';
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

  it('give each Exercise a rep range, from its most recently changed Target', async () => {
    const db = createTestDatabaseBefore('0020_add_exercises_rep_range');
    db.run(sql`INSERT INTO templates (id, name) VALUES ('push', 'Push'), ('heavy', 'Heavy')`);
    // Bench Press has two Targets, the one in Heavy changed later; Squat's only
    // Target was removed from its Template; Dip never had one.
    const target = (id: string, template: string, exercise: string, range: number[], at: number) =>
      db.run(sql`INSERT INTO template_exercises
                   (id, template_id, exercise_id, position, target_sets, min_reps, max_reps,
                    target_weight, target_weight_unit, updated_at)
                 SELECT ${id}, ${template}, id, 0, 3, ${range[0]}, ${range[1]}, 60, 'kg', ${at}
                 FROM exercises WHERE name = ${exercise}`);
    target('target-1', 'push', 'Bench Press', [10, 15], 1790000000000);
    target('target-2', 'heavy', 'Bench Press', [4, 6], 1791000000000);
    target('target-3', 'heavy', 'Squat', [3, 5], 1791000000000);
    db.run(sql`UPDATE template_exercises SET deleted_at = 1792000000000 WHERE id = 'target-3'`);

    migrateToLatest(db);

    const tracker = createTracker(db);
    const rangeOf = async (name: string) => {
      const { minReps, maxReps } = await findExerciseByName(tracker, name);
      return [minReps, maxReps];
    };
    expect(await rangeOf('Bench Press')).toEqual([4, 6]);
    expect(await rangeOf('Squat')).toEqual([8, 12]);
    expect(await rangeOf('Dip')).toEqual([8, 12]);
  });
});
