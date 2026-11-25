import { createTestDatabase } from './test-database';
import { createRotationWith, names } from './test-helpers';
import { canAddToRotation, createTracker, type Rotation, type Tracker } from './tracker';

function categoryNamesOf(rotation: Rotation | undefined) {
  return rotation?.entries.map(({ category }) => category.name);
}

async function activeRotationNames(tracker: Tracker) {
  return names((await tracker.getRotations()).filter(rotation => rotation.isActive));
}

describe('Rotations', () => {
  it('hold a name and Categories, in the order they were added', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    const legs = await tracker.createCategory('Legs');

    const rotation = await tracker.createRotation('PPL');
    for (const category of [push, pull, legs]) {
      await tracker.addCategoryToRotation(rotation.id, { id: category.id });
    }

    const saved = await tracker.getRotation(rotation.id);
    expect(saved?.name).toBe('PPL');
    expect(categoryNamesOf(saved)).toEqual(['Push', 'Pull', 'Legs']);
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

  it('can have Categories removed, keeping the rest in order', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', [
      'Push',
      'Pull',
      'Legs',
    ]);

    await tracker.removeCategoryFromRotation(entries[1].id);

    expect(categoryNamesOf(await tracker.getRotation(rotation.id))).toEqual(['Push', 'Legs']);
    await expect(tracker.removeCategoryFromRotation(entries[1].id)).rejects.toThrow(
      'No such Category in a Rotation',
    );
  });

  it('can have a Category moved to another place, shifting the ones between', async () => {
    const tracker = createTracker(createTestDatabase());
    const { rotation, entries } = await createRotationWith(tracker, 'PPL', [
      'Push',
      'Pull',
      'Legs',
      'Arms',
    ]);

    await tracker.moveCategoryInRotation(entries[3].id, 1);
    expect(categoryNamesOf(await tracker.getRotation(rotation.id))).toEqual([
      'Push',
      'Arms',
      'Pull',
      'Legs',
    ]);

    await tracker.moveCategoryInRotation(entries[0].id, 3);
    expect(categoryNamesOf(await tracker.getRotation(rotation.id))).toEqual([
      'Arms',
      'Pull',
      'Legs',
      'Push',
    ]);
    await expect(tracker.moveCategoryInRotation(entries[0].id, 4)).rejects.toThrow(
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

  it('lose a Category when it is deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    const ppl = await tracker.createRotation('PPL');
    const pushPull = await tracker.createRotation('Push Pull');
    for (const rotation of [ppl, pushPull]) {
      await tracker.addCategoryToRotation(rotation.id, { id: push.id });
      await tracker.addCategoryToRotation(rotation.id, { id: pull.id });
    }

    await tracker.deleteCategory(push.id);

    expect((await tracker.getRotations()).map(categoryNamesOf)).toEqual([['Pull'], ['Pull']]);
  });

  it('are active when made while none is, so next up shows without finding a switch', async () => {
    const tracker = createTracker(createTestDatabase());

    await tracker.createRotation('PPL');

    expect(await activeRotationNames(tracker)).toEqual(['PPL']);
  });

  it("start inactive when made while another is active, so a second one doesn't change what's next", async () => {
    const tracker = createTracker(createTestDatabase());
    await tracker.createRotation('PPL');

    await tracker.createRotation('Upper Lower');

    expect(await activeRotationNames(tracker)).toEqual(['PPL']);
  });

  it('are active when made after the active one was switched off or deleted', async () => {
    const tracker = createTracker(createTestDatabase());
    const ppl = await tracker.createRotation('PPL');
    await tracker.setActiveRotation(null);
    await tracker.createRotation('Upper Lower');
    expect(await activeRotationNames(tracker)).toEqual(['Upper Lower']);

    await tracker.deleteRotation(ppl.id);
    await tracker.setActiveRotation(null);
    await tracker.createRotation('Full Body');
    expect(await activeRotationNames(tracker)).toEqual(['Full Body']);
  });

  it('have at most one active', async () => {
    const tracker = createTracker(createTestDatabase());
    const ppl = await tracker.createRotation('PPL');
    const upperLower = await tracker.createRotation('Upper Lower');
    expect(await activeRotationNames(tracker)).toEqual(['PPL']);

    await tracker.setActiveRotation(upperLower.id);
    expect(await activeRotationNames(tracker)).toEqual(['Upper Lower']);

    await tracker.setActiveRotation(ppl.id);
    expect(await activeRotationNames(tracker)).toEqual(['PPL']);

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

  it('hold each Category once', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const rotation = await tracker.createRotation('PPL');
    await tracker.addCategoryToRotation(rotation.id, { id: push.id });

    await expect(tracker.addCategoryToRotation(rotation.id, { id: push.id })).rejects.toThrow(
      'Push is already in that Rotation',
    );
    expect(categoryNamesOf(await tracker.getRotation(rotation.id))).toEqual(['Push']);
  });

  it('tell screens which Categories can still be added', async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    const rotation = await tracker.createRotation('PPL');
    await tracker.addCategoryToRotation(rotation.id, { id: push.id });

    const saved = await tracker.getRotation(rotation.id);

    expect(saved && canAddToRotation(saved, push.id)).toBe(false);
    expect(saved && canAddToRotation(saved, pull.id)).toBe(true);
  });

  it('take a Category by a new name, making it, so a split can be laid out before training', async () => {
    const tracker = createTracker(createTestDatabase());
    const rotation = await tracker.createRotation('PPL');

    await tracker.addCategoryToRotation(rotation.id, { name: 'Push' });
    await tracker.addCategoryToRotation(rotation.id, { name: ' Pull ' });

    expect(categoryNamesOf(await tracker.getRotation(rotation.id))).toEqual(['Push', 'Pull']);
    expect(names(await tracker.getCategories())).toEqual(['Pull', 'Push']);
    await tracker.setActiveRotation(rotation.id);
    expect((await tracker.getNextUp())?.name).toBe('Push');
  });

  it('take the Category there already when a name is in use, whatever its capitals', async () => {
    const tracker = createTracker(createTestDatabase());
    const legs = await tracker.createCategory('Legs');
    const rotation = await tracker.createRotation('PPL');

    await tracker.addCategoryToRotation(rotation.id, { name: 'legs' });

    const [entry] = (await tracker.getRotation(rotation.id))?.entries ?? [];
    expect(entry.category).toEqual({ id: legs.id, name: 'Legs' });
    expect(names(await tracker.getCategories())).toEqual(['Legs']);
    await expect(tracker.addCategoryToRotation(rotation.id, { name: 'LEGS' })).rejects.toThrow(
      'Legs is already in that Rotation',
    );
  });

  it("don't take a Category with no name, and none is made", async () => {
    const tracker = createTracker(createTestDatabase());
    const rotation = await tracker.createRotation('PPL');

    await expect(tracker.addCategoryToRotation(rotation.id, { name: '  ' })).rejects.toThrow(
      'A Category needs a name',
    );
    await expect(tracker.addCategoryToRotation('no-such', { name: 'Push' })).rejects.toThrow(
      'No such Rotation',
    );
    expect(await tracker.getCategories()).toEqual([]);
  });

  it("can't take a deleted Category, or go in a deleted Rotation", async () => {
    const tracker = createTracker(createTestDatabase());
    const push = await tracker.createCategory('Push');
    const pull = await tracker.createCategory('Pull');
    const rotation = await tracker.createRotation('PPL');
    const gone = await tracker.createRotation('Old');
    await tracker.deleteCategory(pull.id);
    await tracker.deleteRotation(gone.id);

    await expect(tracker.addCategoryToRotation(rotation.id, { id: pull.id })).rejects.toThrow(
      'No such Category',
    );
    await expect(tracker.addCategoryToRotation(gone.id, { id: push.id })).rejects.toThrow(
      'No such Rotation',
    );
  });
});
