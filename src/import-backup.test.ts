import { createTestDatabase } from '@/core/test-database';
import { doWorkout } from '@/core/test-helpers';
import { createTracker, type Tracker } from '@/core/tracker';
import { importBackup } from '@/import-backup';
import { scriptedPrompter } from '@/scripted-prompter';

// A phone where the lifter has done one Workout of this Exercise.
async function phoneWith(exerciseName: string) {
  const tracker = createTracker(createTestDatabase());
  await doWorkout(tracker, exerciseName, [{ weight: 100, reps: 5 }]);
  return tracker;
}

async function exercisesDone(tracker: Tracker) {
  return (await tracker.getProgressExercises()).map(exercise => exercise.name);
}

describe('Importing a Backup file', () => {
  it('replaces everything on the phone once the lifter confirms', async () => {
    const contents = await (await phoneWith('Squat')).exportBackup('1.0.0');
    const phone = await phoneWith('Bench Press');
    const { prompter, asked, told } = scriptedPrompter([true]);

    expect(await importBackup(phone, prompter, contents)).toBe(true);

    expect(asked.map(question => question.title)).toEqual(['Replace all your data?']);
    expect(asked[0].message).toMatch(/^This backup is from \w+day /);
    expect(told.map(({ title }) => title)).toEqual(['Backup imported']);
    expect(await exercisesDone(phone)).toEqual(['Squat']);
  });

  it('leaves the data as it was when the lifter cancels', async () => {
    const contents = await (await phoneWith('Squat')).exportBackup('1.0.0');
    const phone = await phoneWith('Bench Press');
    const { prompter, told } = scriptedPrompter([false]);

    expect(await importBackup(phone, prompter, contents)).toBe(false);

    expect(told).toEqual([]);
    expect(await exercisesDone(phone)).toEqual(['Bench Press']);
  });

  it("refuses a file that isn't a Backup without asking anything", async () => {
    const phone = await phoneWith('Bench Press');
    const { prompter, asked } = scriptedPrompter();

    await expect(importBackup(phone, prompter, 'not a backup')).rejects.toThrow();

    expect(asked).toEqual([]);
    expect(await exercisesDone(phone)).toEqual(['Bench Press']);
  });
});
