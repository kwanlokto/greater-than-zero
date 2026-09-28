import { createTestDatabase } from './test-database';
import {
  createTemplateWith,
  doWorkout,
  entriesOf,
  findExerciseByName,
  startWorkoutWith,
  startWorkoutWithEach,
  threeByEightToTwelve,
} from './test-helpers';
import { createTracker, type SetValues, type Tracker, type WeightUnit } from './tracker';

// Starts the Template and confirms every planned Set as pre-filled.
async function doTemplateAsPlanned(tracker: Tracker, templateId: string) {
  const workout = await tracker.startWorkout({ templateId });
  for (const entry of await entriesOf(tracker, workout.id)) {
    for (const planned of entry.plannedSets) {
      await tracker.confirmPlannedSet(planned.id, planned);
    }
  }
  return workout;
}

describe('The finish summary', () => {
  it('says nothing differs when the Workout did the Template as it is', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await doTemplateAsPlanned(tracker, template.id);

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(false);
  });

  it('says the Exercise list differs when an Exercise was added', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
    await tracker.logSet(added.id, { weight: null, reps: 10 });

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(true);
  });

  it('says the Exercise list differs when an Exercise was removed', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const [, dip] = await entriesOf(tracker, workout.id);
    await tracker.removeExerciseFromWorkout(dip.id);

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(true);
  });

  it('says the Exercise list differs when an Exercise was swapped for another', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [bench, dip] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(bench.plannedSets[0].id, { weight: 60, reps: 10 });
    const inclineBench = await findExerciseByName(tracker, 'Incline Bench Press');
    await tracker.swapExercise(dip.id, inclineBench.id);
    const [, swapped] = await entriesOf(tracker, workout.id);
    await tracker.logSet(swapped.id, { weight: 50, reps: 10 });

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(true);
  });

  it("doesn't count an Exercise skipped on the day, with nothing logged, as removed", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [bench] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(bench.plannedSets[0].id, { weight: 60, reps: 10 });

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(false);
  });

  it("doesn't count an Exercise added with no working Set, as there's no Target to give it", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
    await tracker.logSet(added.id, { weight: null, reps: 5, isWarmUp: true });

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(false);
  });

  it('says nothing differs for a Workout started empty', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 10 });

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(false);
  });

  it('says nothing differs once the Template has been deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
    await tracker.logSet(added.id, { weight: null, reps: 10 });
    await tracker.deleteTemplate(template.id);

    const summary = await tracker.finishWorkout(workout.id);

    expect(summary.differsFromTemplate).toBe(false);
  });
});

// Each Exercise in the Template with its Target, as [name, sets, min, max, weight, unit].
async function targetsOf(tracker: Tracker, templateId: string) {
  const template = await tracker.getTemplate(templateId);
  return template?.exercises.map(({ exercise, target }) => [
    exercise.name,
    target.sets,
    target.minReps,
    target.maxReps,
    target.weight,
    target.weightUnit,
  ]);
}

describe('Updating a Template from a Workout', () => {
  it('leaves the Template as it was until the lifter accepts', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const before = await tracker.getTemplate(template.id);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const [, dip] = await entriesOf(tracker, workout.id);
    await tracker.removeExerciseFromWorkout(dip.id);

    await tracker.finishWorkout(workout.id);

    expect(await tracker.getTemplate(template.id)).toEqual(before);
  });

  it('takes out an Exercise removed from the Workout, the others keeping their Targets', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Dip',
      'Triceps Pushdown',
    ]);
    await tracker.editTarget(exercises[2].id, { ...threeByEightToTwelve, sets: 4, weight: 25 });
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const [, dip] = await entriesOf(tracker, workout.id);
    await tracker.removeExerciseFromWorkout(dip.id);
    await tracker.finishWorkout(workout.id);

    await tracker.updateTemplateFromWorkout(workout.id);

    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Bench Press', 3, 8, 12, 60, 'kg'],
      ['Triceps Pushdown', 4, 8, 12, 25, 'kg'],
    ]);
  });

  it('adds an Exercise added in the Workout, with a Target taken from its working Sets', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const flies = await findExerciseByName(tracker, 'Cable Fly');
    const added = await tracker.addExerciseToWorkout(workout.id, flies.id);
    await tracker.logSet(added.id, { weight: 5, reps: 20, isWarmUp: true });
    await tracker.logSet(added.id, { weight: 15, reps: 12 });
    await tracker.logSet(added.id, { weight: 17.5, reps: 10 });
    await tracker.logSet(added.id, { weight: 15, reps: 14 });
    await tracker.finishWorkout(workout.id);

    await tracker.updateTemplateFromWorkout(workout.id);

    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Bench Press', 3, 8, 12, 60, 'kg'],
      ['Cable Fly', 3, 10, 14, 15, 'kg'],
    ]);
  });

  it('puts an Exercise swapped in where the old one was', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [bench, dip] = await entriesOf(tracker, workout.id);
    const inclineBench = await findExerciseByName(tracker, 'Incline Bench Press');
    await tracker.swapExercise(bench.id, inclineBench.id);
    await tracker.logSet(bench.id, { weight: 50, reps: 9 });
    await tracker.confirmPlannedSet(dip.plannedSets[0].id, dip.plannedSets[0]);
    await tracker.finishWorkout(workout.id);

    await tracker.updateTemplateFromWorkout(workout.id);

    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Incline Bench Press', 1, 9, 9, 50, 'kg'],
      ['Dip', 3, 8, 12, 60, 'kg'],
    ]);
  });

  it('keeps the right Target when the Template holds an Exercise twice', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Dip',
      'Bench Press',
    ]);
    await tracker.editTarget(exercises[2].id, { ...threeByEightToTwelve, weight: 50, sets: 2 });
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const [firstBench] = await entriesOf(tracker, workout.id);
    await tracker.removeExerciseFromWorkout(firstBench.id);
    await tracker.finishWorkout(workout.id);

    await tracker.updateTemplateFromWorkout(workout.id);

    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Dip', 3, 8, 12, 60, 'kg'],
      ['Bench Press', 2, 8, 12, 50, 'kg'],
    ]);
  });

  it('then finds nothing more to change', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const first = await doTemplateAsPlanned(tracker, template.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(first.id, dip.id);
    await tracker.logSet(added.id, { weight: null, reps: 10 });
    await tracker.finishWorkout(first.id);
    await tracker.updateTemplateFromWorkout(first.id);

    const second = await doTemplateAsPlanned(tracker, template.id);
    const summary = await tracker.finishWorkout(second.id);

    expect(summary.differsFromTemplate).toBe(false);
  });

  it('is only for a finished Workout started from a Template', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const inProgress = await doTemplateAsPlanned(tracker, template.id);
    await expect(tracker.updateTemplateFromWorkout(inProgress.id)).rejects.toThrow(
      'No finished Workout from a Template to update it from',
    );
    await tracker.finishWorkout(inProgress.id);
    const startedEmpty = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);

    await expect(tracker.updateTemplateFromWorkout(startedEmpty.id)).rejects.toThrow(
      'No finished Workout from a Template to update it from',
    );
  });
});

describe('A Target taken from what was done', () => {
  // Adds the Exercise to a Workout from a one-Exercise Template, logs these
  // Sets for it, each in its unit (kg unless given), and updates the Template
  // to match. Returns the Target the Exercise gets.
  async function templateTargetAfterLogging(
    exerciseName: string,
    loggedSets: (SetValues & { unit?: WeightUnit })[],
  ) {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const exercise = await findExerciseByName(tracker, exerciseName);
    const added = await tracker.addExerciseToWorkout(workout.id, exercise.id);
    for (const { unit = 'kg', ...set } of loggedSets) {
      await tracker.setDisplayUnit(unit);
      await tracker.logSet(added.id, set);
    }
    await tracker.finishWorkout(workout.id);
    await tracker.updateTemplateFromWorkout(workout.id);
    return (await targetsOf(tracker, template.id))?.[1];
  }

  it('compares weights entered in different units by converting, keeping the lightest as entered', async () => {
    const target = await templateTargetAfterLogging('Overhead Press', [
      { weight: 40, reps: 8 },
      // 38.6 kg.
      { weight: 85, reps: 8, unit: 'lb' },
      { weight: 40, reps: 7 },
    ]);

    expect(target).toEqual(['Overhead Press', 3, 7, 8, 85, 'lb']);
  });

  it('takes plain bodyweight as lighter than any added weight', async () => {
    const target = await templateTargetAfterLogging('Dip', [
      { weight: 10, reps: 8 },
      { weight: null, reps: 12 },
    ]);

    expect(target).toEqual(['Dip', 2, 8, 12, null, 'kg']);
  });

  it('takes assistance as lighter than plain bodyweight', async () => {
    const target = await templateTargetAfterLogging('Pull-up', [
      { weight: null, reps: 5 },
      { weight: -15, reps: 8 },
    ]);

    expect(target).toEqual(['Pull-up', 2, 5, 8, -15, 'kg']);
  });
});

describe('Saving a Workout as a Template', () => {
  it('creates a Template of its Exercises in order, with Targets taken from what was done', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entries } = await startWorkoutWithEach(tracker, [
      'Squat',
      'Leg Curl',
      'Standing Calf Raise',
    ]);
    const [squat, legCurl, calfRaise] = entries;
    await tracker.logSet(squat.id, { weight: 60, reps: 5, isWarmUp: true });
    await tracker.logSet(squat.id, { weight: 100, reps: 5 });
    await tracker.logSet(squat.id, { weight: 100, reps: 4 });
    await tracker.logSet(legCurl.id, { weight: 20, reps: 12, isWarmUp: true });
    await tracker.logSet(calfRaise.id, { weight: 80, reps: 15 });
    await tracker.finishWorkout(workout.id);

    const template = await tracker.saveWorkoutAsTemplate(workout.id, ' Legs ');

    const saved = await tracker.getTemplate(template.id);
    expect(saved?.name).toBe('Legs');
    // Leg Curl was only warmed up, so there's no Target to give it.
    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Squat', 2, 4, 5, 100, 'kg'],
      ['Standing Calf Raise', 1, 15, 15, 80, 'kg'],
    ]);
  });

  it('leaves the Template the Workout started from as it was', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const before = await tracker.getTemplate(template.id);
    const workout = await doTemplateAsPlanned(tracker, template.id);
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
    await tracker.logSet(added.id, { weight: null, reps: 10 });
    await tracker.finishWorkout(workout.id);

    const saved = await tracker.saveWorkoutAsTemplate(workout.id, 'Push B');

    expect(await tracker.getTemplate(template.id)).toEqual(before);
    expect(await targetsOf(tracker, saved.id)).toEqual([
      ['Bench Press', 3, 8, 8, 60, 'kg'],
      ['Dip', 1, 10, 10, null, 'kg'],
    ]);
  });

  it('needs a name', async () => {
    const tracker = createTracker(createTestDatabase());
    const workout = await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 10 }]);

    await expect(tracker.saveWorkoutAsTemplate(workout.id, ' ')).rejects.toThrow(
      'A Template needs a name',
    );
    expect(await tracker.getTemplates()).toEqual([]);
  });

  it('is only for a finished Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 60, reps: 10 });

    await expect(tracker.saveWorkoutAsTemplate(workout.id, 'Push')).rejects.toThrow(
      'No such finished Workout',
    );
    expect(await tracker.getTemplates()).toEqual([]);
  });
});
