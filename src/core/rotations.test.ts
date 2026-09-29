import { createTestDatabase } from './test-database';
import { createRotationWith, createTemplateWith, names } from './test-helpers';
import { canAddToRotation, createTracker, type Rotation, type Tracker } from './tracker';

function templateNamesOf(rotation: Rotation | undefined) {
  return rotation?.entries.map(({ template }) => template.name);
}

async function activeRotationNames(tracker: Tracker) {
  return names((await tracker.getRotations()).filter(rotation => rotation.isActive));
}

describe('Rotations', () => {
  it('hold a name and Templates, in the order they were added', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template: push } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { template: pull } = await createTemplateWith(tracker, 'Pull', ['Pull-up']);
    const { template: legs } = await createTemplateWith(tracker, 'Legs', ['Squat']);

    const rotation = await tracker.createRotation('PPL');
    for (const template of [push, pull, legs]) {
      await tracker.addTemplateToRotation(rotation.id, template.id);
    }

    const saved = await tracker.getRotation(rotation.id);
    expect(saved?.name).toBe('PPL');
    expect(templateNamesOf(saved)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('can be renamed, but not to a blank name', async () => {
    const tracker = createTracker(createTestDatabase());
    const rotation = await tracker.createRotation('PPL');

    await tracker.renameRotation(rotation.id, '  Push Pull Legs ');
    await expect(tracker.renameRotation(rotation.id, '')).rejects.toThrow(
      'A Rotation needs a name',
    );

    expect((await tracker.getRotation(rotation.id))?.name).toBe('Push Pull Legs');
  });

  it('can have Templates removed, keeping the rest in order', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', [
      'Push',
      'Pull',
      'Legs',
    ]);

    await tracker.removeTemplateFromRotation(entries[1].id);

    expect(templateNamesOf(await tracker.getRotation(rotation.id))).toEqual(['Push', 'Legs']);
    await expect(tracker.removeTemplateFromRotation(entries[1].id)).rejects.toThrow(
      'No such Template in a Rotation',
    );
  });

  it('can have a Template moved to another place, shifting the ones between', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', [
      'Push',
      'Pull',
      'Legs',
      'Arms',
    ]);

    await tracker.moveTemplateInRotation(entries[3].id, 1);
    expect(templateNamesOf(await tracker.getRotation(rotation.id))).toEqual([
      'Push',
      'Arms',
      'Pull',
      'Legs',
    ]);

    await tracker.moveTemplateInRotation(entries[0].id, 3);
    expect(templateNamesOf(await tracker.getRotation(rotation.id))).toEqual([
      'Arms',
      'Pull',
      'Legs',
      'Push',
    ]);
    await expect(tracker.moveTemplateInRotation(entries[0].id, 4)).rejects.toThrow(
      'No such place in the Rotation',
    );
  });

  it('are listed by name until deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.createRotation('upper lower');
    const ppl = await tracker.createRotation('PPL');
    await tracker.createRotation('Arnold split');

    await tracker.deleteRotation(ppl.id);

    expect(names(await tracker.getRotations())).toEqual(['Arnold split', 'upper lower']);
    expect(await tracker.getRotation(ppl.id)).toBeUndefined();
    await expect(tracker.deleteRotation(ppl.id)).rejects.toThrow('No such Rotation');
  });

  it('lose a Template when it is deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template: push } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { template: pull } = await createTemplateWith(tracker, 'Pull', ['Pull-up']);
    const ppl = await tracker.createRotation('PPL');
    const pushPull = await tracker.createRotation('Push Pull');
    for (const rotation of [ppl, pushPull]) {
      await tracker.addTemplateToRotation(rotation.id, push.id);
      await tracker.addTemplateToRotation(rotation.id, pull.id);
    }

    await tracker.deleteTemplate(push.id);

    expect((await tracker.getRotations()).map(templateNamesOf)).toEqual([['Pull'], ['Pull']]);
  });

  it('have at most one active', async () => {
    const tracker = createTracker(createTestDatabase());
    const ppl = await tracker.createRotation('PPL');
    const upperLower = await tracker.createRotation('Upper Lower');
    expect(await activeRotationNames(tracker)).toEqual([]);

    await tracker.setActiveRotation(ppl.id);
    expect(await activeRotationNames(tracker)).toEqual(['PPL']);

    await tracker.setActiveRotation(upperLower.id);
    expect(await activeRotationNames(tracker)).toEqual(['Upper Lower']);

    await tracker.setActiveRotation(null);
    expect(await activeRotationNames(tracker)).toEqual([]);
  });

  it('leave none active when the active one is deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const ppl = await tracker.createRotation('PPL');
    const upperLower = await tracker.createRotation('Upper Lower');
    await tracker.setActiveRotation(ppl.id);

    await tracker.deleteRotation(ppl.id);

    expect(await activeRotationNames(tracker)).toEqual([]);
    await expect(tracker.setActiveRotation(ppl.id)).rejects.toThrow('No such Rotation');
    await tracker.setActiveRotation(upperLower.id);
    expect(await activeRotationNames(tracker)).toEqual(['Upper Lower']);
  });

  it('need a name', async () => {
    const tracker = createTracker(createTestDatabase());

    await expect(tracker.createRotation('   ')).rejects.toThrow('A Rotation needs a name');
    expect(await tracker.getRotations()).toEqual([]);
  });

  it('hold each Template once', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template: push } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const rotation = await tracker.createRotation('PPL');
    await tracker.addTemplateToRotation(rotation.id, push.id);

    await expect(tracker.addTemplateToRotation(rotation.id, push.id)).rejects.toThrow(
      'Push is already in that Rotation',
    );
    expect(templateNamesOf(await tracker.getRotation(rotation.id))).toEqual(['Push']);
  });

  it('tell screens which Templates can still be added', async () => {
    const tracker = createTracker(createTestDatabase());
    const { template: push } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { template: pull } = await createTemplateWith(tracker, 'Pull', ['Pull-up']);
    const rotation = await tracker.createRotation('PPL');
    await tracker.addTemplateToRotation(rotation.id, push.id);

    const saved = await tracker.getRotation(rotation.id);

    expect(saved && canAddToRotation(saved, push.id)).toBe(false);
    expect(saved && canAddToRotation(saved, pull.id)).toBe(true);
  });

  it("can't take a deleted Template, or go in a deleted Rotation", async () => {
    const tracker = createTracker(createTestDatabase());
    const { template: push } = await createTemplateWith(tracker, 'Push', ['Bench Press']);
    const { template: pull } = await createTemplateWith(tracker, 'Pull', ['Pull-up']);
    const rotation = await tracker.createRotation('PPL');
    const gone = await tracker.createRotation('Old');
    await tracker.deleteTemplate(pull.id);
    await tracker.deleteRotation(gone.id);

    await expect(tracker.addTemplateToRotation(rotation.id, pull.id)).rejects.toThrow(
      'No such Template',
    );
    await expect(tracker.addTemplateToRotation(gone.id, push.id)).rejects.toThrow(
      'No such Rotation',
    );
  });
});
