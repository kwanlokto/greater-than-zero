import { sql } from 'drizzle-orm';

import { createTestDatabaseBefore, migrateToLatest } from './test-database';
import { createTracker } from './tracker';

type OldDatabase = ReturnType<typeof createTestDatabaseBefore>;

// A phone from before Categories, with Templates of every kind:
// - Push, and a second Template called "push " made later
// - Pull, with a Workout in progress
// - Legs, never trained from
// - Arms, deleted since a Workout was done from it
// and a Rotation, the active one, of Push → Pull → the second push → Legs.
function phoneWithTemplates(): OldDatabase {
  const db = createTestDatabaseBefore('0021_templates_become_categories');
  db.run(sql`INSERT INTO templates (id, name, created_at, deleted_at) VALUES
               ('push', 'Push', 1000, NULL),
               ('pull', 'Pull', 2000, NULL),
               ('push-again', 'push ', 3000, NULL),
               ('legs', 'Legs', 4000, NULL),
               ('arms', 'Arms', 5000, 9000)`);
  db.run(sql`INSERT INTO template_exercises
               (id, template_id, exercise_id, position, target_sets, min_reps, max_reps,
                target_weight, target_weight_unit)
             SELECT 'target-' || templates.id, templates.id, exercises.id, 0, 3, 8, 12, 60, 'kg'
             FROM templates, exercises WHERE exercises.name = 'Bench Press'`);
  db.run(sql`INSERT INTO rotations (id, name, is_active) VALUES ('ppl', 'PPL', 1)`);
  db.run(sql`INSERT INTO rotation_entries (id, rotation_id, template_id, position) VALUES
               ('place-1', 'ppl', 'push', 0),
               ('place-2', 'ppl', 'pull', 1),
               ('place-3', 'ppl', 'push-again', 2),
               ('place-4', 'ppl', 'legs', 3)`);
  const workout = (id: string, date: string, templateId: string | null, finished: boolean) => {
    const startedAt = Date.parse(`${date}T18:00:00-05:00`);
    db.run(sql`INSERT INTO workouts (id, local_date, started_at, finished_at, template_id)
               VALUES (${id}, ${date}, ${startedAt}, ${finished ? startedAt + 3_600_000 : null},
                       ${templateId})`);
    db.run(sql`INSERT INTO exercise_entries (id, workout_id, exercise_id, position, template_exercise_id)
               SELECT ${`entry-${id}`}, ${id}, id, 0, ${templateId && `target-${templateId}`}
               FROM exercises WHERE name = 'Bench Press'`);
    if (finished) {
      db.run(sql`INSERT INTO sets (id, exercise_entry_id, position, weight, weight_unit, reps, logged_at)
                 VALUES (${`set-${id}`}, ${`entry-${id}`}, 0, 60, 'kg', 10, ${startedAt})`);
    }
  };
  workout('from-push', '2026-11-02', 'push', true);
  workout('from-push-again', '2026-11-04', 'push-again', true);
  workout('from-arms', '2026-11-06', 'arms', true);
  workout('from-nothing', '2026-11-08', null, true);
  workout('from-pull', '2026-11-10', 'pull', false);
  db.run(sql`INSERT INTO planned_sets (id, exercise_entry_id, position, weight, weight_unit, reps)
             VALUES ('planned-1', 'entry-from-pull', 0, 60, 'kg', 8)`);
  return db;
}

describe('Templates becoming Categories', () => {
  it('keeps each Template as a Category of the same name, with its Workouts', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const tracker = createTracker(db);
    const categoryOf = async (date: string) =>
      (await tracker.getDay(date)).workouts.map(workout => workout.categoryName);
    expect((await tracker.getCategories()).map(category => category.name)).toEqual([
      'Legs',
      'Pull',
      'Push',
    ]);
    expect(await categoryOf('2026-11-02')).toEqual(['Push']);
    expect(await categoryOf('2026-11-08')).toEqual([null]);
  });

  it('makes one Category of Templates with the same name, the earliest made', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const tracker = createTracker(db);
    const [repeatedPush] = (await tracker.getDay('2026-11-04')).workouts;
    expect(repeatedPush).toMatchObject({ categoryId: 'push', categoryName: 'Push' });
  });

  it('keeps Rotations in order, a Category that came up twice keeping its first place', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const [rotation] = await createTracker(db).getRotations();
    expect(rotation).toMatchObject({ name: 'PPL', isActive: true });
    expect(rotation.entries.map(({ category }) => category.name)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('leaves a Workout from a deleted Template in no Category', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const [fromArms] = (await createTracker(db).getDay('2026-11-06')).workouts;
    expect(fromArms).toMatchObject({ categoryId: null, categoryName: null });
    expect(fromArms.entries[0].sets).toHaveLength(1);
  });

  it('keeps a Workout in progress, with its planned Sets', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const inProgress = await createTracker(db).getWorkoutInProgress();
    expect(inProgress).toMatchObject({ id: 'from-pull', categoryName: 'Pull' });
    expect(inProgress?.entries[0].plannedSets).toEqual([
      { id: 'planned-1', weight: 60, weightUnit: 'kg', reps: 8, isWarmUp: false },
    ]);
  });

  it('drops Template exercises and their Targets, breaking no link', async () => {
    const db = phoneWithTemplates();

    migrateToLatest(db);

    const tables = db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map(({ name }) => name);
    expect(tables).not.toContain('templates');
    expect(tables).not.toContain('template_exercises');
    expect(db.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
  });

});
