import journal from '../../drizzle/meta/_journal.json';
import { createTestDatabase } from './test-database';
import {
  clockAt,
  createRotationWith,
  doTemplateWorkout,
  doWorkout,
  startWorkoutWith,
} from './test-helpers';
import { createTracker, type BackupFile, type Tracker } from './tracker';

// A phone with a little of everything on it: a display unit, a hidden custom
// Exercise, a Rotation of Templates, finished Workouts and one in progress.
async function phoneWithData() {
  const clock = clockAt('2026-09-28T18:00:00-04:00');
  const tracker = createTracker(createTestDatabase(), clock);
  await tracker.setDisplayUnit('lb');
  const landmine = await tracker.createExercise({
    name: 'Landmine Press',
    trackingType: 'weighted',
    muscleGroup: 'shoulders',
  });
  await tracker.hideExercise(landmine.id);
  const { rotation, templates } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull']);
  await tracker.setActiveRotation(rotation.id);
  await doTemplateWorkout(tracker, templates[0].id);
  clock.setTime('2026-09-29T18:00:00-04:00');
  await doWorkout(tracker, 'Squat', [{ weight: 225, reps: 5 }]);
  const { entry } = await startWorkoutWith(tracker, 'Deadlift');
  await tracker.logSet(entry.id, { weight: 315, reps: 3 });
  return { tracker, clock };
}

// The Backup file with its first Set changed.
function withFirstSet(backup: BackupFile, change: (set: Record<string, unknown>) => object) {
  const [first, ...rest] = backup.tables.sets;
  return JSON.stringify({
    ...backup,
    tables: { ...backup.tables, sets: [change(first), ...rest] },
  });
}

// All the data on a phone, as its Backup file holds it.
async function dataOn(tracker: Tracker) {
  const { tables } = JSON.parse(await tracker.exportBackup('1.2.3'));
  return tables;
}

describe('Backup import', () => {
  it('replaces all the data on a phone with what was exported, exactly', async () => {
    const { tracker: oldPhone } = await phoneWithData();
    const backup = await oldPhone.exportBackup('1.2.3');
    const newPhone = createTracker(createTestDatabase());
    await doWorkout(newPhone, 'Bench Press', [{ weight: 60, reps: 10 }]);

    await newPhone.importBackup(backup);

    expect(await dataOn(newPhone)).toEqual(await dataOn(oldPhone));
    expect((await newPhone.getWorkoutInProgress())?.entries[0].exercise.name).toBe('Deadlift');
    expect((await newPhone.getNextUp())?.name).toBe('Pull');
  });

  it('leaves the data untouched when the file fails partway through', async () => {
    const { tracker: oldPhone } = await phoneWithData();
    const backup = JSON.parse(await oldPhone.exportBackup('1.2.3'));
    backup.tables.sets.push({ ...backup.tables.sets[0] });
    const { tracker: phone } = await phoneWithData();
    const before = await dataOn(phone);

    await expect(phone.importBackup(JSON.stringify(backup))).rejects.toThrow();

    expect(await dataOn(phone)).toEqual(before);
  });

  it("leaves the data untouched when the file's records point to ones it doesn't have", async () => {
    const { tracker: oldPhone } = await phoneWithData();
    const backup = JSON.parse(await oldPhone.exportBackup('1.2.3'));
    backup.tables.exercise_entries = [];
    backup.tables.planned_sets = [];
    const { tracker: phone } = await phoneWithData();
    const before = await dataOn(phone);

    await expect(phone.importBackup(JSON.stringify(backup))).rejects.toThrow(
      "That file isn't a Greater Than Zero backup, or it's damaged: some of its records point to ones it doesn't have.",
    );

    expect(await dataOn(phone)).toEqual(before);
  });

  it.each([
    ['format version', { formatVersion: 2 }],
    ['schema version', { schemaVersion: journal.entries.length + 1 }],
  ])(
    'refuses a file with a newer %s, from a newer app, leaving the data untouched',
    async (_, newer) => {
      const { tracker: oldPhone } = await phoneWithData();
      const backup = { ...JSON.parse(await oldPhone.exportBackup('1.2.3')), ...newer };
      const { tracker: phone } = await phoneWithData();
      const before = await dataOn(phone);

      await expect(phone.importBackup(JSON.stringify(backup))).rejects.toThrow(
        'That backup is from a newer version of Greater Than Zero. Update the app, then import it again.',
      );

      expect(await dataOn(phone)).toEqual(before);
    },
  );

  it.each<[string, (backup: BackupFile) => string]>([
    ["text that isn't JSON", () => 'Push day: bench 3 × 8'],
    ["JSON that isn't an object", () => '[1, 2, 3]'],
    ['no format version', ({ formatVersion, ...rest }) => JSON.stringify(rest)],
    [
      "a schema version that isn't a whole number",
      backup => JSON.stringify({ ...backup, schemaVersion: '14' }),
    ],
    ['no tables', ({ tables, ...rest }) => JSON.stringify(rest)],
    [
      "a table that isn't a list of rows",
      backup => JSON.stringify({ ...backup, tables: { ...backup.tables, sets: {} } }),
    ],
    [
      'a table the app has never had',
      backup => JSON.stringify({ ...backup, tables: { ...backup.tables, cardio: [] } }),
    ],
    ['a column the app has never had', backup => withFirstSet(backup, set => ({ ...set, rpe: 8 }))],
    [
      "a value that isn't text, a number or empty",
      backup => withFirstSet(backup, set => ({ ...set, reps: true })),
    ],
    [
      "a value its column can't hold",
      backup => withFirstSet(backup, set => ({ ...set, weight_unit: 'stone' })),
    ],
    [
      'a table missing',
      ({ tables: { sets, ...tables }, ...rest }) => JSON.stringify({ ...rest, tables }),
    ],
    [
      'no settings',
      backup => JSON.stringify({ ...backup, tables: { ...backup.tables, settings: [] } }),
    ],
  ])('rejects a file with %s, leaving the data untouched', async (_, damaged) => {
    const { tracker: oldPhone } = await phoneWithData();
    const backup = JSON.parse(await oldPhone.exportBackup('1.2.3'));
    const { tracker: phone } = await phoneWithData();
    const before = await dataOn(phone);

    await expect(phone.importBackup(damaged(backup))).rejects.toThrow(
      "That file isn't a Greater Than Zero backup, or it's damaged",
    );

    expect(await dataOn(phone)).toEqual(before);
  });

  it('takes a file from before a table or column was added, leaving them empty', async () => {
    const { tracker: oldPhone } = await phoneWithData();
    // As an app from before Rotations (schema version 13) would have written it.
    const {
      tables: { rotations, rotation_entries, ...tables },
      ...backup
    } = JSON.parse(await oldPhone.exportBackup('1.2.3'));
    const beforeRotations = {
      ...backup,
      schemaVersion: 13,
      tables: {
        ...tables,
        workouts: tables.workouts.map(
          ({ rotation_id, ...workout }: Record<string, unknown>) => workout,
        ),
      },
    };
    const phone = createTracker(createTestDatabase());

    await phone.importBackup(JSON.stringify(beforeRotations));

    expect(await phone.getRotations()).toEqual([]);
    const [workout] = (await phone.getDay('2026-09-28')).workouts;
    expect(workout.rotationId).toBeNull();
    expect(workout.entries.map(entry => entry.exercise.name)).toEqual(['Bench Press']);
  });

  it('can be checked first, to say where the file is from, changing nothing', async () => {
    const { tracker: oldPhone } = await phoneWithData();
    const backup = await oldPhone.exportBackup('1.2.3');
    const { tracker: phone } = await phoneWithData();
    const before = await dataOn(phone);

    expect(await phone.checkBackup(backup)).toEqual({
      exportedAt: new Date('2026-09-29T18:00:00-04:00'),
      appVersion: '1.2.3',
    });
    await expect(phone.checkBackup('Push day')).rejects.toThrow(
      "That file isn't a Greater Than Zero backup, or it's damaged",
    );
    expect(await dataOn(phone)).toEqual(before);
  });
});
