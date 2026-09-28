import { createTestDatabase } from './test-database';
import {
  createTemplateWith,
  entriesOf,
  findExerciseByName,
  startWorkoutWith,
  threeByEightToTwelve,
} from './test-helpers';
import {
  createTracker,
  type FinishSummary,
  type SetValues,
  type Tracker,
  type WeightUnit,
} from './tracker';

type LoggedSet = SetValues & { unit?: WeightUnit };

// Starts the Template, logs these Sets for each of its Exercises in turn, each
// in its unit (kg unless given), and finishes. Returns the Workout and the
// finish summary.
async function doTemplate(tracker: Tracker, templateId: string, setsByExercise: LoggedSet[][]) {
  const workout = await tracker.startWorkout({ templateId });
  const entries = await entriesOf(tracker, workout.id);
  for (const [index, loggedSets] of setsByExercise.entries()) {
    for (const { unit = 'kg', ...set } of loggedSets) {
      await tracker.setDisplayUnit(unit);
      await tracker.logSet(entries[index].id, set);
    }
  }
  const summary = await tracker.finishWorkout(workout.id);
  return { workout, summary };
}

// Each offer as [Exercise, proposed weight, its unit].
function offersOf(summary: FinishSummary) {
  return summary.targetUpdateOffers.map(offer => [
    offer.exercise.name,
    offer.weight,
    offer.weightUnit,
  ]);
}

const threeSetsOf = (weight: number | null, reps: number, unit?: WeightUnit): LoggedSet[] =>
  Array.from({ length: 3 }, () => ({ weight, reps, unit }));

describe('Target update offers', () => {
  it('offer the lightest working weight when every working Set beat the Target', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [
      [
        { weight: 65, reps: 8 },
        { weight: 62.5, reps: 9 },
        { weight: 65, reps: 8 },
      ],
    ]);

    expect(offersOf(summary)).toEqual([['Bench Press', 62.5, 'kg']]);
  });

  it('offer nothing when one working Set was no heavier than the Target', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [
      [
        { weight: 65, reps: 8 },
        { weight: 60, reps: 12 },
        { weight: 65, reps: 8 },
      ],
    ]);

    expect(offersOf(summary)).toEqual([]);
  });

  it('offer nothing when a working Set fell short of the rep-range minimum', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [
      [
        { weight: 65, reps: 8 },
        { weight: 65, reps: 8 },
        { weight: 65, reps: 7 },
      ],
    ]);

    expect(offersOf(summary)).toEqual([]);
  });

  it("offer nothing with fewer working Sets than the Target's", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [
      [
        { weight: 70, reps: 10 },
        { weight: 70, reps: 10 },
      ],
    ]);

    expect(offersOf(summary)).toEqual([]);
  });

  it('ignore warm-ups, which neither count as Sets nor need to beat the Target', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const tooFew = await doTemplate(tracker, template.id, [
      [
        { weight: 40, reps: 10, isWarmUp: true },
        { weight: 65, reps: 8, isWarmUp: true },
        { weight: 65, reps: 8 },
        { weight: 65, reps: 8 },
      ],
    ]);
    const enough = await doTemplate(tracker, template.id, [
      [{ weight: 40, reps: 10, isWarmUp: true }, ...threeSetsOf(65, 8)],
    ]);

    expect(offersOf(tooFew.summary)).toEqual([]);
    expect(offersOf(enough.summary)).toEqual([['Bench Press', 65, 'kg']]);
  });

  it('compare Sets in other units after converting, offering the lightest in the unit it was entered in', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [
      [
        { weight: 65, reps: 8 },
        // 63.5 kg.
        { weight: 140, reps: 8, unit: 'lb' },
        { weight: 65, reps: 8 },
      ],
    ]);

    expect(offersOf(summary)).toEqual([['Bench Press', 140, 'lb']]);
  });

  it("don't count a weight that converts a hair heavier as heavier", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press'], {
      ...threeByEightToTwelve,
      weight: 135,
      weightUnit: 'lb',
    });

    // 61.25 kg is 135.03 lb: the same weight, loaded in kilogram plates.
    const { summary } = await doTemplate(tracker, template.id, [threeSetsOf(61.25, 10)]);

    expect(offersOf(summary)).toEqual([]);
  });

  it('never lower a Target after a worse session', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    const { summary } = await doTemplate(tracker, template.id, [threeSetsOf(50, 6)]);

    expect(offersOf(summary)).toEqual([]);
    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect([target.weight, target.weightUnit]).toEqual([60, 'kg']);
  });

  it('use added weight for bodyweight Exercises', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Pull', [
      'Pull-up',
      'Chin-up',
      'Dip',
    ]);
    await tracker.editTarget(exercises[0].id, { ...threeByEightToTwelve, weight: null });
    await tracker.editTarget(exercises[1].id, { ...threeByEightToTwelve, weight: -20 });
    await tracker.editTarget(exercises[2].id, { ...threeByEightToTwelve, weight: 10 });

    const { summary } = await doTemplate(tracker, template.id, [
      // A belt beats plain bodyweight.
      [
        { weight: 5, reps: 8 },
        { weight: 2.5, reps: 8 },
        { weight: 5, reps: 8 },
      ],
      // Less help from the machine, then none, beats the assisted Target.
      [
        { weight: -10, reps: 8 },
        { weight: null, reps: 8 },
        { weight: -10, reps: 8 },
      ],
      // Plain bodyweight doesn't beat an added 10 kg.
      threeSetsOf(null, 12),
    ]);

    expect(offersOf(summary)).toEqual([
      ['Pull-up', 2.5, 'kg'],
      ['Chin-up', -10, 'kg'],
    ]);
  });

  it('judge each copy of an Exercise the Template holds twice against its own Target', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Bench Press',
    ]);
    await tracker.editTarget(exercises[1].id, { ...threeByEightToTwelve, weight: 50 });

    const { summary } = await doTemplate(tracker, template.id, [
      threeSetsOf(60, 10),
      threeSetsOf(55, 10),
    ]);

    const offers = summary.targetUpdateOffers;
    expect(offers.map(offer => [offer.templateExerciseId, offer.weight])).toEqual([
      [exercises[1].id, 55],
    ]);
  });

  it("aren't made for Exercises added to the Workout, or a Workout started empty", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const dip = await findExerciseByName(tracker, 'Dip');
    const added = await tracker.addExerciseToWorkout(workout.id, dip.id);
    for (const set of threeSetsOf(20, 10)) await tracker.logSet(added.id, set);
    const fromTemplate = await tracker.finishWorkout(workout.id);
    const { workout: empty, entry } = await startWorkoutWith(tracker, 'Bench Press');
    for (const set of threeSetsOf(100, 10)) await tracker.logSet(entry.id, set);
    const startedEmpty = await tracker.finishWorkout(empty.id);

    expect([offersOf(fromTemplate), offersOf(startedEmpty)]).toEqual([[], []]);
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

describe('Accepting a Target update offer', () => {
  it("changes only that Exercise's Target weight, leaving the others for their own answer", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
    ]);
    await tracker.editTarget(exercises[1].id, { ...threeByEightToTwelve, weight: 40 });
    const { workout, summary } = await doTemplate(tracker, template.id, [
      threeSetsOf(140, 8, 'lb'),
      threeSetsOf(42.5, 8),
    ]);
    expect(offersOf(summary)).toHaveLength(2);

    await tracker.acceptTargetUpdate(workout.id, exercises[0].id);

    expect(await targetsOf(tracker, template.id)).toEqual([
      ['Bench Press', 3, 8, 12, 140, 'lb'],
      ['Overhead Press', 3, 8, 12, 40, 'kg'],
    ]);
  });

  it('leaves the Target as it was when declined, by not accepting', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const before = await tracker.getTemplate(template.id);

    await doTemplate(tracker, template.id, [threeSetsOf(65, 8)]);

    expect(await tracker.getTemplate(template.id)).toEqual(before);
  });

  it("is refused for a session that didn't beat the Target", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { workout } = await doTemplate(tracker, template.id, [threeSetsOf(50, 6)]);

    await expect(tracker.acceptTargetUpdate(workout.id, exercises[0].id)).rejects.toThrow(
      "That session didn't beat the Target",
    );
    expect(await targetsOf(tracker, template.id)).toEqual([['Bench Press', 3, 8, 12, 60, 'kg']]);
  });

  it('happens once: the raised Target is no longer beaten by the same session', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { workout } = await doTemplate(tracker, template.id, [
      [
        { weight: 65, reps: 8 },
        { weight: 62.5, reps: 8 },
        { weight: 65, reps: 8 },
      ],
    ]);
    await tracker.acceptTargetUpdate(workout.id, exercises[0].id);

    await expect(tracker.acceptTargetUpdate(workout.id, exercises[0].id)).rejects.toThrow(
      "That session didn't beat the Target",
    );
    expect(await targetsOf(tracker, template.id)).toEqual([['Bench Press', 3, 8, 12, 62.5, 'kg']]);
  });

  it('is only for a finished Workout', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [entry] = await entriesOf(tracker, workout.id);
    for (const set of threeSetsOf(65, 8)) await tracker.logSet(entry.id, set);

    await expect(tracker.acceptTargetUpdate(workout.id, exercises[0].id)).rejects.toThrow(
      'No such finished Workout',
    );
  });
});

describe('The "ready to go heavier" hint', () => {
  // Whether the Template's first Exercise shows the hint once it's started.
  async function hintOnStarting(tracker: Tracker, templateId: string) {
    const workout = await tracker.startWorkout({ templateId });
    const [entry] = await entriesOf(tracker, workout.id);
    return tracker.isReadyToGoHeavier(entry.id);
  }

  it('shows when last session hit the top of the rep range on every Set at the Target weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [threeSetsOf(60, 12)]);

    expect(await hintOnStarting(tracker, template.id)).toBe(true);
  });

  it('shows for Sets at or above the Target weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [
      [
        { weight: 60, reps: 12 },
        { weight: 62.5, reps: 12 },
        { weight: 60, reps: 13 },
      ],
    ]);

    expect(await hintOnStarting(tracker, template.id)).toBe(true);
  });

  it("doesn't show when a Set fell short of the top of the rep range", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [
      [
        { weight: 60, reps: 12 },
        { weight: 60, reps: 12 },
        { weight: 60, reps: 11 },
      ],
    ]);

    expect(await hintOnStarting(tracker, template.id)).toBe(false);
  });

  it("doesn't show when a Set was lighter than the Target weight", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [
      [
        { weight: 60, reps: 12 },
        { weight: 57.5, reps: 12 },
        { weight: 60, reps: 12 },
      ],
    ]);

    expect(await hintOnStarting(tracker, template.id)).toBe(false);
  });

  it("doesn't show with fewer working Sets than the Target's, warm-ups not counting", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [
      [
        { weight: 60, reps: 12, isWarmUp: true },
        { weight: 60, reps: 12 },
        { weight: 60, reps: 12 },
      ],
    ]);

    expect(await hintOnStarting(tracker, template.id)).toBe(false);
  });

  it('goes by the most recent session under that Template', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [threeSetsOf(60, 12)]);
    await doTemplate(tracker, template.id, [threeSetsOf(60, 10)]);
    // Top reps outside the Template don't count.
    const { workout, entry } = await startWorkoutWith(tracker, 'Bench Press');
    for (const set of threeSetsOf(60, 12)) await tracker.logSet(entry.id, set);
    await tracker.finishWorkout(workout.id);

    expect(await hintOnStarting(tracker, template.id)).toBe(false);
  });

  it('follows an Exercise swapped away and back again last session', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const workout = await tracker.startWorkout({ templateId: template.id });
    const [entry] = await entriesOf(tracker, workout.id);
    const inclineBench = await findExerciseByName(tracker, 'Incline Bench Press');
    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    await tracker.swapExercise(entry.id, inclineBench.id);
    await tracker.swapExercise(entry.id, benchPress.id);
    for (const set of threeSetsOf(60, 12)) await tracker.logSet(entry.id, set);
    await tracker.finishWorkout(workout.id);

    expect(await hintOnStarting(tracker, template.id)).toBe(true);
  });

  it('treats a weight that converts a hair lighter as the Target weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press'], {
      ...threeByEightToTwelve,
      weight: 135,
      weightUnit: 'lb',
    });
    // 61.2 kg is 134.9 lb.
    await doTemplate(tracker, template.id, [threeSetsOf(61.2, 12)]);

    expect(await hintOnStarting(tracker, template.id)).toBe(true);
  });

  it('uses added weight for bodyweight Exercises, blank or 0 both being plain bodyweight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Pull', ['Pull-up'], {
      ...threeByEightToTwelve,
      weight: null,
    });
    await doTemplate(tracker, template.id, [
      [
        { weight: null, reps: 12 },
        { weight: 0, reps: 12 },
        { weight: null, reps: 12 },
      ],
    ]);

    expect(await hintOnStarting(tracker, template.id)).toBe(true);
  });

  it('compares with the Target as it is now', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await doTemplate(tracker, template.id, [threeSetsOf(60, 12)]);
    await tracker.editTarget(exercises[0].id, { ...threeByEightToTwelve, weight: 62.5 });

    expect(await hintOnStarting(tracker, template.id)).toBe(false);
  });

  it('shows only in a Workout in progress, for an Exercise from the Template', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { workout: first } = await doTemplate(tracker, template.id, [threeSetsOf(60, 12)]);
    const second = await tracker.startWorkout({ templateId: template.id });
    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    const added = await tracker.addExerciseToWorkout(second.id, benchPress.id);
    const [finishedEntry] = await entriesOf(tracker, first.id);

    expect(await tracker.isReadyToGoHeavier(added.id)).toBe(false);
    expect(await tracker.isReadyToGoHeavier(finishedEntry.id)).toBe(false);
  });
});
