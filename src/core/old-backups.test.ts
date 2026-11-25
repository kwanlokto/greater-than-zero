import { sql } from 'drizzle-orm';

import journal from '../../drizzle/meta/_journal.json';
import {
  backupFileOf,
  createTestDatabase,
  createTestDatabaseAt,
  createTestDatabaseBefore,
  migrateTo,
  migrateToLatest,
  openScratchDatabase,
  schemaVersionBefore,
} from './test-database';
import { doWorkout } from './test-helpers';
import { createTracker, type Tracker } from './tracker';

type OldDatabase = ReturnType<typeof createTestDatabaseAt>;
type Tables = Record<string, Record<string, unknown>[]>;

const damagedFile = "That file isn't a Notch backup, or it's damaged";

// The schema version of the first app that exported Backup files (#20), from
// before Meals: the oldest a Backup file can be.
const oldest = schemaVersionBefore('0014_create_meals');

// The format an app at each schema version wrote its Backup files in: 1, and
// one more for each migration that came with a step upgrading older files,
// before the migrations took that over (docs/adr/0002).
const formatBumps = [
  '0018_drop_exercise_entries_notes',
  '0020_add_exercises_rep_range',
  '0021_templates_become_categories',
  '0022_drop_workouts_rotation_id',
].map(schemaVersionBefore);
function formatVersionAt(schemaVersion: number) {
  return 1 + formatBumps.filter(before => before < schemaVersion).length;
}

// A phone at the oldest version that could export a Backup file, holding some
// of everything later migrations change:
// - Exercise notes, warm-ups, a rest length, a hidden custom Exercise
// - Templates with Targets: Push, a later "push " that becomes one Category
//   with it, Pull, Legs never trained from, and Arms, deleted after a Workout
// - the active Rotation Push → Pull → "push " → Legs, with Workouts recorded
//   against it
// - a backfilled Workout with no Template, a discarded one, and Pull in
//   progress with its rest running and Sets still planned
function oldestPhone(): OldDatabase {
  const db = createTestDatabaseAt(oldest);
  db.run(sql`UPDATE settings SET display_unit = 'lb', default_rest_seconds = 90`);
  db.run(sql`UPDATE exercises SET default_rest_seconds = 180 WHERE name = 'Squat'`);
  db.run(sql`INSERT INTO exercises (id, name, tracking_type, muscle_group, is_custom, deleted_at)
             VALUES ('landmine', 'Landmine Press', 'weighted', 'shoulders', 1, 1000)`);
  db.run(sql`INSERT INTO templates (id, name, created_at, updated_at, deleted_at) VALUES
               ('push', 'Push', 1000, 1000, NULL),
               ('pull', 'Pull', 2000, 2000, NULL),
               ('push-again', 'push ', 3000, 3000, NULL),
               ('legs', 'Legs', 4000, 4000, NULL),
               ('arms', 'Arms', 5000, 9000, 9000)`);
  const target = (
    id: string,
    templateId: string,
    exercise: string,
    [minReps, maxReps]: [number, number],
    weight: number | null,
    updatedAt: number,
    deletedAt: number | null = null,
  ) =>
    db.run(sql`INSERT INTO template_exercises
                 (id, template_id, exercise_id, position, target_sets, min_reps, max_reps,
                  target_weight, target_weight_unit, updated_at, deleted_at)
               SELECT ${id}, ${templateId}, id, 0, 3, ${minReps}, ${maxReps}, ${weight}, 'kg',
                      ${updatedAt}, ${deletedAt}
               FROM exercises WHERE name = ${exercise}`);
  // Bench Press is in both Pushes, the later one changed last, and in Arms,
  // changed later still but deleted with it.
  target('target-push', 'push', 'Bench Press', [5, 8], 60, 1500);
  target('target-pull', 'pull', 'Pull-up', [6, 10], null, 2500);
  target('target-push-again', 'push-again', 'Bench Press', [6, 10], 55, 3500);
  target('target-legs', 'legs', 'Squat', [3, 5], 100, 4500);
  target('target-arms', 'arms', 'Bench Press', [12, 15], 30, 9000, 9000);
  db.run(sql`INSERT INTO rotations (id, name, is_active) VALUES ('ppl', 'PPL', 1)`);
  db.run(sql`INSERT INTO rotation_entries (id, rotation_id, template_id, position) VALUES
               ('place-push', 'ppl', 'push', 0),
               ('place-pull', 'ppl', 'pull', 1),
               ('place-push-again', 'ppl', 'push-again', 2),
               ('place-legs', 'ppl', 'legs', 3)`);

  // A Workout of one Exercise at 6 pm on `date`, finished an hour later unless
  // it's still in progress.
  const workout = (
    id: string,
    date: string,
    exercise: string,
    from: { templateId?: string; rotationId?: string; targetId?: string } = {},
    { inProgress = false, backfilled = false, discarded = false } = {},
  ) => {
    const startedAt = Date.parse(`${date}T18:00:00-04:00`);
    db.run(sql`INSERT INTO workouts
                 (id, local_date, started_at, finished_at, rest_ends_at, is_backfilled,
                  template_id, rotation_id, deleted_at)
               VALUES (${id}, ${date}, ${startedAt},
                       ${inProgress || discarded ? null : startedAt + 3_600_000},
                       ${inProgress ? startedAt + 120_000 : null}, ${backfilled ? 1 : 0},
                       ${from.templateId ?? null}, ${from.rotationId ?? null},
                       ${discarded ? startedAt + 60_000 : null})`);
    db.run(sql`INSERT INTO exercise_entries
                 (id, workout_id, exercise_id, position, notes, template_exercise_id)
               SELECT ${`entry-${id}`}, ${id}, id, 0, ${id === 'from-push' ? 'Pause at the bottom' : ''},
                      ${from.targetId ?? null}
               FROM exercises WHERE name = ${exercise}`);
    return `entry-${id}`;
  };
  const sets = (
    entryId: string,
    logged: [weight: number | null, unit: string, reps: number, warmUp?: boolean][],
  ) =>
    logged.forEach(([weight, unit, reps, warmUp = false], position) =>
      db.run(sql`INSERT INTO sets
                   (id, exercise_entry_id, position, weight, weight_unit, reps, is_warm_up, logged_at)
                 VALUES (${`${entryId}-set-${position}`}, ${entryId}, ${position}, ${weight},
                         ${unit}, ${reps}, ${warmUp ? 1 : 0}, ${1_789_000_000_000 + position})`),
    );

  const ppl = { rotationId: 'ppl' };
  const push = workout('from-push', '2026-09-01', 'Bench Press', {
    templateId: 'push',
    targetId: 'target-push',
    ...ppl,
  });
  sets(push, [[40, 'kg', 10, true], [60, 'kg', 8], [60, 'kg', 8], [60, 'kg', 6]]);
  db.run(sql`UPDATE sets SET deleted_at = 1789000001000 WHERE id = ${`${push}-set-3`}`);
  const pushAgain = workout('from-push-again', '2026-09-03', 'Bench Press', {
    templateId: 'push-again',
    targetId: 'target-push-again',
    ...ppl,
  });
  sets(pushAgain, [[55, 'kg', 10], [55, 'kg', 9]]);
  const arms = workout('from-arms', '2026-09-05', 'Bench Press', {
    templateId: 'arms',
    targetId: 'target-arms',
  });
  sets(arms, [[30, 'kg', 15]]);
  const backfilled = workout('backfilled', '2026-09-06', 'Squat', {}, { backfilled: true });
  sets(backfilled, [[225, 'lb', 5], [225, 'lb', 5]]);
  workout('discarded', '2026-09-07', 'Deadlift', {}, { discarded: true });
  const pull = workout(
    'from-pull',
    '2026-09-08',
    'Pull-up',
    { templateId: 'pull', targetId: 'target-pull', ...ppl },
    { inProgress: true },
  );
  sets(pull, [[null, 'kg', 8]]);
  db.run(sql`INSERT INTO planned_sets (id, exercise_entry_id, position, weight, weight_unit, reps)
             VALUES ('planned-1', ${pull}, 0, NULL, 'kg', 8),
                    ('planned-2', ${pull}, 1, NULL, 'kg', 8)`);
  return db;
}

// Everything on a phone, as its Backup file holds it. When a row was deleted
// is left out: a migration stamps the moment it runs, which isn't the same
// for a phone updating and for a file being imported.
async function dataOn(tracker: Tracker) {
  const { tables } = JSON.parse(await tracker.exportBackup('1.0.0')) as { tables: Tables };
  return Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.map(row => ({ ...row, deleted_at: row.deleted_at !== null })),
    ]),
  );
}

// A phone of today's version with a Workout of its own on it.
async function phoneWithAWorkout() {
  const phone = createTracker(createTestDatabase(), { openScratchDatabase });
  await doWorkout(phone, 'Deadlift', [{ weight: 140, reps: 5 }]);
  return phone;
}

describe('A Backup file from an older version of Notch', () => {
  const versions = Array.from(
    { length: journal.entries.length - oldest + 1 },
    (_, index) => oldest + index,
  );

  it.each(versions)(
    'from schema version %i imports just as the phone itself updated',
    async schemaVersion => {
      const phone = oldestPhone();
      migrateTo(phone, schemaVersion);
      const file = backupFileOf(phone, formatVersionAt(schemaVersion));
      migrateToLatest(phone);
      const newPhone = await phoneWithAWorkout();

      await newPhone.importBackup(file);

      expect(await dataOn(newPhone)).toEqual(await dataOn(createTracker(phone)));
      expect((await newPhone.getWorkoutInProgress())?.categoryName).toBe('Pull');
    },
  );

  it.each<[string, (tables: Tables) => void]>([
    [
      'leaves out a table its version had',
      tables => {
        delete tables.rotations;
      },
    ],
    [
      'leaves out a column its version had',
      tables => {
        for (const entry of tables.exercise_entries) delete entry.notes;
      },
    ],
    [
      'has a table its version never had',
      tables => {
        tables.meals = [];
      },
    ],
  ])('is refused when it %s, changing nothing', async (_, damage) => {
    const file = JSON.parse(backupFileOf(oldestPhone(), 1));
    damage(file.tables);
    const phone = await phoneWithAWorkout();
    const before = await dataOn(phone);

    await expect(phone.importBackup(JSON.stringify(file))).rejects.toThrow(damagedFile);

    expect(await dataOn(phone)).toEqual(before);
  });

  it("is refused when it can't be brought up to date, changing nothing", async () => {
    // From before the built-in Exercise library (0003), with an Exercise that
    // already has a built-in's ID, so adding the library fails.
    const old = createTestDatabaseBefore('0003_insert_built_in_exercises');
    old.run(sql`INSERT INTO exercises (id, name, tracking_type, muscle_group)
                VALUES ('727a98e3-704c-4027-8be1-9a2b89dec956', 'Bench Press', 'weighted', 'chest')`);
    const phone = await phoneWithAWorkout();
    const before = await dataOn(phone);

    await expect(phone.importBackup(backupFileOf(old, 1))).rejects.toThrow(
      `${damagedFile}: it couldn't be brought up to date.`,
    );

    expect(await dataOn(phone)).toEqual(before);
  });
});
