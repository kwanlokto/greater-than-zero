import { createTestDatabase } from './test-database';
import { findExerciseByName } from './test-helpers';
import { createTracker, type TargetValues, type Template, type Tracker } from './tracker';

const threeByEightToTwelve: TargetValues = {
  sets: 3,
  minReps: 8,
  maxReps: 12,
  weight: 60,
  weightUnit: 'kg',
};

// A Template holding these Exercises, in order, each with the same Target.
async function createTemplateWith(tracker: Tracker, name: string, exerciseNames: string[]) {
  const template = await tracker.createTemplate(name);
  const exercises = [];
  for (const exerciseName of exerciseNames) {
    const exercise = await findExerciseByName(tracker, exerciseName);
    exercises.push(
      await tracker.addExerciseToTemplate(template.id, exercise.id, threeByEightToTwelve),
    );
  }
  return { template, exercises };
}

function exerciseNamesOf(template: Template | undefined) {
  return template?.exercises.map(({ exercise }) => exercise.name);
}

describe('Templates', () => {
  it('hold a name and Exercises from the library, in the order they were added', async () => {
    const tracker = createTracker(createTestDatabase());

    const { template } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);

    const saved = await tracker.getTemplate(template.id);
    expect(saved?.name).toBe('Push');
    expect(exerciseNamesOf(saved)).toEqual(['Bench Press', 'Overhead Press', 'Triceps Pushdown']);
  });

  it('give each Exercise a Target of sets × rep range @ weight, kept in the unit it was entered in', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.setDisplayUnit('lb');
    const template = await tracker.createTemplate('Push');
    const benchPress = await findExerciseByName(tracker, 'Bench Press');

    await tracker.addExerciseToTemplate(template.id, benchPress.id, {
      sets: 3,
      minReps: 8,
      maxReps: 12,
      weight: 60,
      weightUnit: 'kg',
    });

    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect(target).toEqual({
      sets: 3,
      minReps: 8,
      maxReps: 12,
      weight: 60,
      weightUnit: 'kg',
      displayWeight: { value: 132.3, unit: 'lb' },
    });
  });

  it('give bodyweight Exercises a Target of added weight: none, a belt, or assistance', async () => {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Pull');
    const pullUp = await findExerciseByName(tracker, 'Pull-up');
    const dip = await findExerciseByName(tracker, 'Dip');
    const chinUp = await findExerciseByName(tracker, 'Chin-up');

    for (const [exercise, weight] of [
      [pullUp, null],
      [dip, 10],
      [chinUp, -20],
    ] as const) {
      await tracker.addExerciseToTemplate(template.id, exercise.id, {
        ...threeByEightToTwelve,
        weight,
      });
    }

    const saved = await tracker.getTemplate(template.id);
    expect(saved?.exercises.map(({ target }) => target.displayWeight)).toEqual([
      null,
      { value: 10, unit: 'kg' },
      { value: -20, unit: 'kg' },
    ]);
  });
});

describe('The Template list', () => {
  it('shows every Template by name, ignoring case', async () => {
    const tracker = createTracker(createTestDatabase());
    await createTemplateWith(tracker, 'push', ['Bench Press']);
    await createTemplateWith(tracker, 'Legs', ['Squat', 'Leg Curl']);
    await tracker.createTemplate('Pull');

    const listed = await tracker.getTemplates();

    expect(listed.map(template => [template.name, exerciseNamesOf(template)])).toEqual([
      ['Legs', ['Squat', 'Leg Curl']],
      ['Pull', []],
      ['push', ['Bench Press']],
    ]);
  });
});

describe('Deleting a Template', () => {
  it('takes it off the list', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await tracker.createTemplate('Pull');

    await tracker.deleteTemplate(template.id);

    expect((await tracker.getTemplates()).map(({ name }) => name)).toEqual(['Pull']);
    expect(await tracker.getTemplate(template.id)).toBeUndefined();
  });

  it('leaves nothing in it to change', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const dip = await findExerciseByName(tracker, 'Dip');

    await tracker.deleteTemplate(template.id);

    await expect(tracker.renameTemplate(template.id, 'Push A')).rejects.toThrow('No such Template');
    await expect(
      tracker.addExerciseToTemplate(template.id, dip.id, { ...threeByEightToTwelve, weight: null }),
    ).rejects.toThrow('No such Template');
    await expect(tracker.editTarget(exercises[0].id, threeByEightToTwelve)).rejects.toThrow(
      'No such Exercise in a Template',
    );
    await expect(tracker.moveTemplateExercise(exercises[0].id, 0)).rejects.toThrow(
      'No such Exercise in a Template',
    );
    await expect(tracker.deleteTemplate(template.id)).rejects.toThrow('No such Template');
  });
});

describe('Template names', () => {
  it('leave out the spaces typed around them', async () => {
    const tracker = createTracker(createTestDatabase());

    const template = await tracker.createTemplate('  Push day ');

    expect((await tracker.getTemplate(template.id))?.name).toBe('Push day');
  });

  it("can't be blank", async () => {
    const tracker = createTracker(createTestDatabase());

    await expect(tracker.createTemplate('  ')).rejects.toThrow('A Template needs a name');
  });

  it('can be changed, keeping the Exercises', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    await tracker.renameTemplate(template.id, 'Push A');

    const renamed = await tracker.getTemplate(template.id);
    expect(renamed?.name).toBe('Push A');
    expect(exerciseNamesOf(renamed)).toEqual(['Bench Press']);
  });

  it("can't be changed to a blank name", async () => {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Push');

    await expect(tracker.renameTemplate(template.id, '')).rejects.toThrow(
      'A Template needs a name',
    );
    expect((await tracker.getTemplate(template.id))?.name).toBe('Push');
  });
});

describe("A Template's Exercises", () => {
  it("come from the library, so a hidden Exercise can't be added", async () => {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Push');
    const arnoldPress = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.hideExercise(arnoldPress.id);

    await expect(
      tracker.addExerciseToTemplate(template.id, arnoldPress.id, threeByEightToTwelve),
    ).rejects.toThrow('No such Exercise in the library');
  });

  it('stay in the Template when hidden from the library afterwards', async () => {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Push');
    const arnoldPress = await tracker.createExercise({
      name: 'Arnold Press',
      trackingType: 'weighted',
      muscleGroup: 'shoulders',
    });
    await tracker.addExerciseToTemplate(template.id, arnoldPress.id, threeByEightToTwelve);

    await tracker.hideExercise(arnoldPress.id);

    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual(['Arnold Press']);
  });

  it('can be removed, leaving the others in order', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);

    await tracker.removeExerciseFromTemplate(exercises[1].id);

    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual([
      'Bench Press',
      'Triceps Pushdown',
    ]);
  });

  it("can't be removed twice", async () => {
    const tracker = createTracker(createTestDatabase());
    const { exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    await tracker.removeExerciseFromTemplate(exercises[0].id);

    await expect(tracker.removeExerciseFromTemplate(exercises[0].id)).rejects.toThrow(
      'No such Exercise in a Template',
    );
  });

  it('go at the end when added after one was removed', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
    ]);
    await tracker.removeExerciseFromTemplate(exercises[1].id);
    const dip = await findExerciseByName(tracker, 'Dip');

    await tracker.addExerciseToTemplate(template.id, dip.id, {
      ...threeByEightToTwelve,
      weight: null,
    });

    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual(['Bench Press', 'Dip']);
  });

  it('can be moved earlier', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);

    await tracker.moveTemplateExercise(exercises[2].id, 0);

    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual([
      'Triceps Pushdown',
      'Bench Press',
      'Overhead Press',
    ]);
  });

  it('can be moved later, keeping their Targets', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);
    await tracker.editTarget(exercises[0].id, { ...threeByEightToTwelve, sets: 5 });

    await tracker.moveTemplateExercise(exercises[0].id, 1);

    const moved = await tracker.getTemplate(template.id);
    expect(moved?.exercises.map(({ exercise, target }) => [exercise.name, target.sets])).toEqual([
      ['Overhead Press', 3],
      ['Bench Press', 5],
      ['Triceps Pushdown', 3],
    ]);
  });

  it('are moved among the ones still in the Template', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
      'Triceps Pushdown',
    ]);
    await tracker.removeExerciseFromTemplate(exercises[0].id);

    await tracker.moveTemplateExercise(exercises[2].id, 0);

    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual([
      'Triceps Pushdown',
      'Overhead Press',
    ]);
  });

  it("can't be moved outside the list", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', [
      'Bench Press',
      'Overhead Press',
    ]);

    await expect(tracker.moveTemplateExercise(exercises[0].id, 2)).rejects.toThrow(
      'No such place in the Template',
    );
    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual([
      'Bench Press',
      'Overhead Press',
    ]);
  });
});

describe('Targets', () => {
  async function addBenchPressWith(target: TargetValues) {
    const tracker = createTracker(createTestDatabase());
    const template = await tracker.createTemplate('Push');
    const benchPress = await findExerciseByName(tracker, 'Bench Press');
    const added = tracker.addExerciseToTemplate(template.id, benchPress.id, target);
    return { tracker, template, added };
  }

  it('need at least 1 set', async () => {
    const { tracker, template, added } = await addBenchPressWith({
      ...threeByEightToTwelve,
      sets: 0,
    });

    await expect(added).rejects.toThrow('A Target needs a whole number of sets, at least 1');
    expect(exerciseNamesOf(await tracker.getTemplate(template.id))).toEqual([]);
  });

  it("can't have a rep-range minimum above its maximum", async () => {
    const { added } = await addBenchPressWith({ ...threeByEightToTwelve, minReps: 12, maxReps: 8 });

    await expect(added).rejects.toThrow("A rep range's minimum can't be more than its maximum");
  });

  it('can aim for an exact number of reps, with the minimum and maximum the same', async () => {
    const { tracker, template, added } = await addBenchPressWith({
      ...threeByEightToTwelve,
      minReps: 5,
      maxReps: 5,
    });
    await added;

    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect([target.minReps, target.maxReps]).toEqual([5, 5]);
  });

  it('need whole numbers of reps, at least 1', async () => {
    const { added } = await addBenchPressWith({ ...threeByEightToTwelve, minReps: 0 });

    await expect(added).rejects.toThrow('A rep range needs whole numbers of reps, at least 1');
  });

  it('need a weight for a weighted Exercise', async () => {
    const { added } = await addBenchPressWith({ ...threeByEightToTwelve, weight: null });

    await expect(added).rejects.toThrow('A weighted Target needs a weight');
  });

  it("can't have a negative weight for a weighted Exercise", async () => {
    const { added } = await addBenchPressWith({ ...threeByEightToTwelve, weight: -5 });

    await expect(added).rejects.toThrow('Only bodyweight Targets can have a negative weight');
  });
});

describe('Changing a Target', () => {
  it('replaces its sets, rep range and weight', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    await tracker.editTarget(exercises[0].id, {
      sets: 5,
      minReps: 3,
      maxReps: 5,
      weight: 225,
      weightUnit: 'lb',
    });

    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect(target).toEqual({
      sets: 5,
      minReps: 3,
      maxReps: 5,
      weight: 225,
      weightUnit: 'lb',
      displayWeight: { value: 102.1, unit: 'kg' },
    });
  });

  it('is refused when the new Target breaks the rules, keeping the old one', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Push', ['Bench Press']);

    await expect(
      tracker.editTarget(exercises[0].id, { ...threeByEightToTwelve, minReps: 10, maxReps: 6 }),
    ).rejects.toThrow("A rep range's minimum can't be more than its maximum");
    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect([target.minReps, target.maxReps]).toEqual([8, 12]);
  });

  it('follows the rules of the Exercise it belongs to', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template, exercises } = await createTemplateWith(tracker, 'Pull', ['Pull-up']);

    await tracker.editTarget(exercises[0].id, { ...threeByEightToTwelve, weight: null });

    const [{ target }] = (await tracker.getTemplate(template.id))?.exercises ?? [];
    expect(target.weight).toBeNull();
  });
});
