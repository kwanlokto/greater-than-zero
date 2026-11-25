import { createTestDatabase } from './test-database';
import {
  createTemplateWith,
  entriesOf,
  entryToLog,
  findExerciseByName,
  startWorkoutWith,
  targetsOf,
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
      await tracker.logSet(entries[index].id, set, unit);
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

  it('compare weights in the same unit exactly', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press'], {
      ...threeByEightToTwelve,
      weight: 135,
      weightUnit: 'lb',
    });

    const { summary } = await doTemplate(tracker, template.id, [threeSetsOf(135.1, 10, 'lb')]);

    expect(offersOf(summary)).toEqual([['Bench Press', 135.1, 'lb']]);
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
    for (const set of threeSetsOf(20, 10)) await tracker.logSet(added.id, set, 'kg');
    const fromTemplate = await tracker.finishWorkout(workout.id);
    const { workout: empty, entry } = await startWorkoutWith(tracker, 'Bench Press');
    for (const set of threeSetsOf(100, 10)) await tracker.logSet(entry.id, set, 'kg');
    const startedEmpty = await tracker.finishWorkout(empty.id);

    expect([offersOf(fromTemplate), offersOf(startedEmpty)]).toEqual([[], []]);
  });
});

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
    for (const set of threeSetsOf(65, 8)) await tracker.logSet(entry.id, set, 'kg');

    await expect(tracker.acceptTargetUpdate(workout.id, exercises[0].id)).rejects.toThrow(
      'No such finished Workout',
    );
  });
});
