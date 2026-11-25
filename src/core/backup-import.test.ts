import journal from '../../drizzle/meta/_journal.json';
import { backupFormatVersion } from './backup';
import {
  backupFileOf,
  createTestDatabase,
  createTestDatabaseBefore,
  openScratchDatabase,
} from './test-database';
import {
  clockAt,
  createRotationWith,
  doCategoryWorkout,
  doWorkout,
  startWorkoutWith,
} from './test-helpers';
import { createTracker, type BackupFile, type Tracker } from './tracker';

const damagedFile = "That file isn't a Notch backup, or it's damaged";
const fromNewerApp =
  'That backup is from a newer version of Notch. Update the app, then import it again.';

// A format version only a newer app could have written.
const newerFormat = backupFormatVersion + 1;

// A phone with a little of everything on it: a display unit, a hidden custom
// Exercise, a Rotation of Categories, finished Workouts and one in progress.
async function phoneWithData() {
  const clock = clockAt('2026-09-28T18:00:00-04:00');
  const tracker = createTracker(createTestDatabase(), { ...clock, openScratchDatabase });
  await tracker.setDisplayUnit('lb');
  await tracker.setMacroTargets({ calories: 2400, protein: 180, carbs: null, fat: null });
  await tracker.setWeighIn(182.4, 'lb');
  const landmine = await tracker.createExercise({
    name: 'Landmine Press',
    trackingType: 'weighted',
    muscleGroup: 'shoulders',
  });
  await tracker.hideExercise(landmine.id);
  const { rotation, categories } = await createRotationWith(tracker, 'PPL', ['Push', 'Pull']);
  await tracker.setActiveRotation(rotation.id);
  await doCategoryWorkout(tracker, categories[0].id);
  clock.setTime('2026-09-29T18:00:00-04:00');
  await doWorkout(tracker, 'Squat', [{ weight: 225, reps: 5 }], 'lb');
  const { entry } = await startWorkoutWith(tracker, 'Deadlift');
  await tracker.logSet(entry.id, { weight: 315, reps: 3 }, 'lb');
  return tracker;
}

// The Backup file of a phone with data, read back to change.
async function backupWithData(): Promise<BackupFile> {
  return JSON.parse(await (await phoneWithData()).exportBackup('1.2.3'));
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

// Imports the file onto a phone with data of its own, expecting it to be
// refused with `message` and the phone's data left as it was.
async function expectRefused(contents: string, message: string) {
  const phone = await phoneWithData();
  const before = await dataOn(phone);

  await expect(phone.importBackup(contents)).rejects.toThrow(message);

  expect(await dataOn(phone)).toEqual(before);
}

describe('Backup import', () => {
  it('replaces all the data on a phone with what was exported, exactly', async () => {
    const oldPhone = await phoneWithData();
    const backup = await oldPhone.exportBackup('1.2.3');
    const newPhone = createTracker(createTestDatabase(), { openScratchDatabase });
    await doWorkout(newPhone, 'Bench Press', [{ weight: 60, reps: 10 }]);

    await newPhone.importBackup(backup);

    expect(await dataOn(newPhone)).toEqual(await dataOn(oldPhone));
    expect((await newPhone.getWorkoutInProgress())?.entries[0].exercise.name).toBe('Deadlift');
    expect((await newPhone.getNextUp())?.name).toBe('Pull');
  });

  it('leaves the data untouched when the file fails partway through', async () => {
    const backup = await backupWithData();
    backup.tables.sets.push({ ...backup.tables.sets[0] });

    await expectRefused(
      JSON.stringify(backup),
      `${damagedFile}: some of its records repeat or leave out details.`,
    );
  });

  it("leaves the data untouched when the file's records point to ones it doesn't have", async () => {
    const backup = await backupWithData();
    backup.tables.exercise_entries = [];
    backup.tables.planned_sets = [];

    await expectRefused(
      JSON.stringify(backup),
      `${damagedFile}: some of its records point to ones it doesn't have.`,
    );
  });

  it.each<[string, (backup: BackupFile) => object]>([
    ['format version', backup => ({ ...backup, formatVersion: newerFormat })],
    ['format version, laid out differently', () => ({ formatVersion: newerFormat, workouts: [] })],
    ['schema version', backup => ({ ...backup, schemaVersion: journal.entries.length + 1 })],
  ])('refuses a file with a newer %s, from a newer app', async (_, newer) => {
    await expectRefused(JSON.stringify(newer(await backupWithData())), fromNewerApp);
  });

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
    [
      'no settings table, even from an older app',
      () => {
        const file = JSON.parse(backupFileOf(createTestDatabaseBefore('0013_create_rotations'), 1));
        delete file.tables.settings;
        return JSON.stringify(file);
      },
    ],
  ])('rejects a file with %s', async (_, damaged) => {
    await expectRefused(damaged(await backupWithData()), damagedFile);
  });

  it('can be checked first, as far as its header, to say when it was exported, changing nothing', async () => {
    const backup = await backupWithData();
    const phone = await phoneWithData();
    const before = await dataOn(phone);

    expect(await phone.checkBackup(JSON.stringify(backup))).toEqual({
      exportedAt: new Date('2026-09-29T18:00:00-04:00'),
    });
    // Its tables are checked only as it's imported.
    const damagedTables = JSON.stringify({ ...backup, tables: { ...backup.tables, sets: {} } });
    expect(await phone.checkBackup(damagedTables)).toEqual({
      exportedAt: new Date('2026-09-29T18:00:00-04:00'),
    });
    await expect(phone.checkBackup('Push day')).rejects.toThrow(damagedFile);
    expect(await dataOn(phone)).toEqual(before);
  });

  it('is refused by a tracker with nowhere to bring it up to date, changing nothing', async () => {
    const backup = await (await phoneWithData()).exportBackup('1.2.3');
    const phone = createTracker(createTestDatabase());
    await doWorkout(phone, 'Bench Press', [{ weight: 60, reps: 10 }]);
    const before = await dataOn(phone);

    await expect(phone.importBackup(backup)).rejects.toThrow(
      "This tracker can't import Backup files",
    );

    expect(await dataOn(phone)).toEqual(before);
  });
});
