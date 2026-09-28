import { createTestDatabase } from './test-database';
import {
  clockAt,
  createTemplateWith,
  doWorkout,
  entriesOf,
  findExerciseByName,
  setsOf,
  startWorkoutWith,
  threeByEightToTwelve,
  weightsAndReps,
} from './test-helpers';
import { canFinishWorkout, createTracker, type Workout } from './tracker';

// Each Exercise's name, with how many Sets are logged and how many planned.
function setCountsOf(workout: Workout | undefined) {
  return workout?.entries.map(entry => [
    entry.exercise.name,
    entry.sets.length,
    entry.plannedSets.length,
  ]);
}

describe('Starting a Workout from a Template', () => {
  it("adds the Template's Exercises in order, each with its target number of planned Sets", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);

    const workout = await tracker.startWorkout({ templateId: template.id });

    const started = await tracker.getWorkout(workout.id);
    expect(started?.templateId).toBe(template.id);
    expect(setCountsOf(started)).toEqual([
      ['Bench Press', 0, 3],
      ['Dip', 0, 3],
    ]);
  });

  it('pre-fills planned Sets with the Target weight and the bottom of the rep range', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press'], {
      ...threeByEightToTwelve,
      sets: 2,
      weight: 135,
      weightUnit: 'lb',
    });

    const workout = await tracker.startWorkout({ templateId: template.id });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.plannedSets.map(set => [set.weight, set.weightUnit, set.reps])).toEqual([
      [135, 'lb', 8],
      [135, 'lb', 8],
    ]);
  });

  it("takes reps from the same working Set last session, and the rep-range minimum past its end", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press'], {
      ...threeByEightToTwelve,
      sets: 4,
    });
    await doWorkout(tracker, 'Bench Press', [
      { weight: 60, reps: 11 },
      { weight: 60, reps: 10 },
      { weight: 60, reps: 9 },
    ]);

    const workout = await tracker.startWorkout({ templateId: template.id });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.plannedSets.map(set => set.reps)).toEqual([11, 10, 9, 8]);
  });

  it('counts only working Sets still logged when matching positions with last session', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { workout: last, entry } = await startWorkoutWith(tracker, 'Bench Press');
    await tracker.logSet(entry.id, { weight: 40, reps: 15, isWarmUp: true });
    await tracker.logSet(entry.id, { weight: 60, reps: 12 });
    await tracker.logSet(entry.id, { weight: 60, reps: 3 });
    await tracker.logSet(entry.id, { weight: 60, reps: 10 });
    await tracker.logSet(entry.id, { weight: 60, reps: 9 });
    const mistake = (await setsOf(tracker, last.id))[2];
    await tracker.deleteSet(mistake.id);
    await tracker.finishWorkout(last.id);

    const workout = await tracker.startWorkout({ templateId: template.id });

    const [planned] = await entriesOf(tracker, workout.id);
    expect(planned.plannedSets.map(set => set.reps)).toEqual([12, 10, 9]);
  });

  it('takes reps from the most recent finished session of the Exercise', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 12 }]);
    await doWorkout(tracker, 'Bench Press', [{ weight: 62.5, reps: 9 }]);

    const workout = await tracker.startWorkout({ templateId: template.id });

    const [planned] = await entriesOf(tracker, workout.id);
    expect(planned.plannedSets.map(set => set.reps)).toEqual([9, 8, 8]);
  });

  it('counts Set positions on across an Exercise that the Template holds twice', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(
      tracker,
      'Push',
      ['Bench Press', 'Dip', 'Bench Press'],
      { ...threeByEightToTwelve, sets: 2 },
    );
    await doWorkout(tracker, 'Bench Press', [
      { weight: 60, reps: 12 },
      { weight: 60, reps: 11 },
      { weight: 60, reps: 10 },
    ]);

    const workout = await tracker.startWorkout({ templateId: template.id });

    const entries = await entriesOf(tracker, workout.id);
    expect(entries.map(entry => entry.plannedSets.map(set => set.reps))).toEqual([
      [12, 11],
      [8, 8],
      [10, 8],
    ]);
  });

  it('pre-fills a bodyweight Exercise with its Target added weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Pull', ['Pull-up'], {
      ...threeByEightToTwelve,
      weight: -20,
    });

    const workout = await tracker.startWorkout({ templateId: template.id });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.plannedSets.map(set => [set.weight, set.weightUnit])).toEqual([
      [-20, 'kg'],
      [-20, 'kg'],
      [-20, 'kg'],
    ]);
  });
});

describe('A Workout started from a Template', () => {
  it("is a copy: changing its Exercises doesn't change the Template", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const before = await tracker.getTemplate(template.id);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [bench, dip] = await entriesOf(tracker, workout.id);
    const inclineBench = await findExerciseByName(tracker, 'Incline Bench Press');
    const pushdown = await findExerciseByName(tracker, 'Triceps Pushdown');

    await tracker.swapExercise(bench.id, inclineBench.id);
    await tracker.removeExerciseFromWorkout(dip.id);
    await tracker.addExerciseToWorkout(workout.id, pushdown.id);

    expect(await tracker.getTemplate(template.id)).toEqual(before);
    const changed = await tracker.getWorkout(workout.id);
    expect(changed?.entries.map(entry => entry.exercise.name)).toEqual([
      'Incline Bench Press',
      'Triceps Pushdown',
    ]);
    expect(changed?.templateId).toBe(template.id);
  });

  it('drops the planned Sets of an Exercise swapped for another, as they were for the old one', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Pull', ['Pull-up'], {
      ...threeByEightToTwelve,
      weight: null,
    });
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [entry] = await entriesOf(tracker, workout.id);
    const latPulldown = await findExerciseByName(tracker, 'Lat Pulldown');

    await tracker.swapExercise(entry.id, latPulldown.id);

    const [swapped] = await entriesOf(tracker, workout.id);
    expect(swapped.plannedSets).toEqual([]);
    await expect(
      tracker.confirmPlannedSet(entry.plannedSets[0].id, { weight: null, reps: 8 }),
    ).rejects.toThrow('No such planned Set');
  });

  it('starts empty from a Template with no Exercises yet, like an empty Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Push');

    const workout = await tracker.startWorkout({ templateId: template.id });

    const started = await tracker.getWorkout(workout.id);
    expect([started?.templateId, started?.entries]).toEqual([template.id, []]);
  });

  it("can't start from a deleted Template", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await tracker.deleteTemplate(template.id);

    await expect(tracker.startWorkout({ templateId: template.id })).rejects.toThrow(
      'No such Template',
    );
    expect(await tracker.getWorkoutInProgress()).toBeNull();
  });

  it("can't start while another Workout is in progress", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const inProgress = await tracker.startWorkout();

    await expect(tracker.startWorkout({ templateId: template.id })).rejects.toThrow(
      'A Workout is already in progress',
    );
    expect((await tracker.getWorkoutInProgress())?.id).toBe(inProgress.id);
  });

  it('backfilled onto an earlier date, pre-fills from the session before that date', async () => {
    const clock = clockAt('2026-09-10T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 11 }]);
    clock.setTime('2026-09-14T18:00:00');
    await doWorkout(tracker, 'Bench Press', [{ weight: 60, reps: 12 }]);
    clock.setTime('2026-09-15T09:00:00');

    const workout = await tracker.startWorkout({
      localDate: '2026-09-12',
      templateId: template.id,
    });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.plannedSets.map(set => set.reps)).toEqual([11, 8, 8]);
  });
});

describe('Confirming a planned Set', () => {
  it('logs it with the numbers confirmed, in the Target weight unit, and takes it off the plan', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    const [entry] = await entriesOf(tracker, workout.id);
    expect(entry.sets.map(set => [set.weight, set.weightUnit, set.reps, set.isWarmUp])).toEqual([
      [60, 'kg', 10, false],
    ]);
    expect(entry.plannedSets.map(set => set.id)).toEqual([plannedSets[1].id, plannedSets[2].id]);
  });

  it('logs the numbers as changed on the day', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 57.5, reps: 6 });

    expect(weightsAndReps(await setsOf(tracker, workout.id))).toEqual([[57.5, 6]]);
  });

  it('starts the rest, like any logged Set', async () => {
    const clock = clockAt('2026-09-28T18:00:00');
    const tracker = createTracker(createTestDatabase(), clock);
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);
    clock.setTime('2026-09-28T18:05:00');

    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    expect((await tracker.getWorkout(workout.id))?.restEndsAt).toEqual(
      new Date('2026-09-28T18:07:00'),
    );
  });

  it('is refused when the numbers make no Set, leaving it planned', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);

    await expect(
      tracker.confirmPlannedSet(plannedSets[0].id, { weight: null, reps: 10 }),
    ).rejects.toThrow('A weighted Set needs a weight');
    const [entry] = await entriesOf(tracker, workout.id);
    expect([entry.sets.length, entry.plannedSets.length]).toEqual([0, 3]);
  });

  it("can't happen twice", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [{ plannedSets }] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 });

    await expect(
      tracker.confirmPlannedSet(plannedSets[0].id, { weight: 60, reps: 10 }),
    ).rejects.toThrow('No such planned Set');
    expect(await setsOf(tracker, workout.id)).toHaveLength(1);
  });
});

describe('Finishing a Workout started from a Template', () => {
  it('drops the planned Sets never confirmed, keeping the logged ones', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press', 'Dip']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [bench] = await entriesOf(tracker, workout.id);
    await tracker.confirmPlannedSet(bench.plannedSets[0].id, { weight: 60, reps: 10 });

    await tracker.finishWorkout(workout.id);

    const finished = await tracker.getWorkout(workout.id);
    expect(setCountsOf(finished)).toEqual([
      ['Bench Press', 1, 0],
      ['Dip', 0, 0],
    ]);
  });

  it('needs a logged Set: planned ones alone are nothing done', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const started = { entries: await entriesOf(tracker, workout.id) };

    expect(canFinishWorkout(started)).toBe(false);
    await expect(tracker.finishWorkout(workout.id)).rejects.toThrow(
      'A Workout needs at least one Set to be finished',
    );
  });

  it("leaves planned Sets out of the next session's pre-fill and \"last time\"", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const first = await tracker.startWorkout({ templateId: template.id });
    const [entry] = await entriesOf(tracker, first.id);
    await tracker.confirmPlannedSet(entry.plannedSets[0].id, { weight: 60, reps: 12 });
    await tracker.finishWorkout(first.id);

    const second = await tracker.startWorkout({ templateId: template.id });

    const [next] = await entriesOf(tracker, second.id);
    expect(next.plannedSets.map(set => set.reps)).toEqual([12, 8, 8]);
    expect((await tracker.getLastTime(next.id))?.sets.map(set => set.reps)).toEqual([12]);
  });
});
