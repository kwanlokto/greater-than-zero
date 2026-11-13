// Rotations: Templates done in turn, and the one next up.

import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

import { moveInList, notDeleted, positionAfterLast, softDelete, stillThere } from './records';
import { rotationEntries, rotations, templates } from './schema';
import type { SessionHistory } from './session-history';
import type { Template } from './templates';
import type { TrackerDatabase } from './tracker';

// Templates done in turn, e.g. Push → Pull → Legs. The active one decides
// which Template is next up.
export type Rotation = {
  id: string;
  name: string;
  isActive: boolean;
  // In the order they come up.
  entries: RotationEntry[];
};

// A Template at its place in a Rotation.
export type RotationEntry = {
  id: string;
  template: Pick<Template, 'id' | 'name'>;
};

// A Template comes up once in a Rotation, so next up knows where it's at.
// addTemplateToRotation enforces it; screens use it to decide which Templates
// to offer.
export function canAddToRotation(rotation: Pick<Rotation, 'entries'>, templateId: string): boolean {
  return rotation.entries.every(({ template }) => template.id !== templateId);
}

// The Rotation next up comes from.
function activeRotation() {
  return and(eq(rotations.isActive, true), notDeleted(rotations));
}

function requireRotationName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Rotation needs a name');
  return name;
}

type RotationDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  history: SessionHistory;
  findTemplates: (where: SQL | undefined) => Promise<Template[]>;
};

export type Rotations = ReturnType<typeof createRotations>;

export function createRotations({ db, now, history, findTemplates }: RotationDependencies) {
  // The active Rotation, when the Template is in it: the one a Workout started
  // from the Template counts toward. Synchronous, so it can run inside a
  // transaction.
  function idOfActiveRotationWith(templateId: string, tx: TrackerDatabase = db) {
    return tx
      .select({ id: rotations.id })
      .from(rotations)
      .innerJoin(rotationEntries, eq(rotationEntries.rotationId, rotations.id))
      .where(
        and(
          activeRotation(),
          eq(rotationEntries.templateId, templateId),
          notDeleted(rotationEntries),
        ),
      )
      .get()?.id;
  }

  // The Rotations matching `where`, by name, each with its Templates in order.
  // Deleted Rotations and removed Templates are left out.
  async function findRotations(where: SQL | undefined): Promise<Rotation[]> {
    return db.query.rotations.findMany({
      where: and(where, notDeleted(rotations)),
      orderBy: sql`${rotations.name} COLLATE NOCASE`,
      columns: { id: true, name: true, isActive: true },
      with: {
        entries: {
          where: notDeleted(rotationEntries),
          orderBy: asc(rotationEntries.position),
          columns: { id: true },
          with: { template: { columns: { id: true, name: true } } },
        },
      },
    });
  }

  // The Template to do next from the active Rotation: the one after the
  // Template of the last finished Workout that counted toward it, wrapping
  // around. The first one when there's no such Workout, or its Template has
  // since left the Rotation. Null with no active Rotation, or an empty one.
  // The Workout finishingWorkoutId counts as finished already, so
  // finishWorkout can work it out before finishing it.
  async function findNextUp(finishingWorkoutId?: string): Promise<Template | null> {
    const [active] = await findRotations(activeRotation());
    if (!active || active.entries.length === 0) return null;
    const lastTemplateId = await history.lastTemplateInRotation(active.id, finishingWorkoutId);
    // -1 when it's not there, so the first one.
    const lastIndex = active.entries.findIndex(({ template }) => template.id === lastTemplateId);
    const next = active.entries[(lastIndex + 1) % active.entries.length];
    const [template] = await findTemplates(eq(templates.id, next.template.id));
    return template ?? null;
  }

  const commands = {
    async createRotation(name: string): Promise<{ id: string }> {
      return db
        .insert(rotations)
        .values({ name: requireRotationName(name) })
        .returning({ id: rotations.id })
        .get();
    },

    // Appends the Template after the ones already in the Rotation. Enforces
    // canAddToRotation's rule against the saved Rotation.
    async addTemplateToRotation(rotationId: string, templateId: string): Promise<{ id: string }> {
      // Checked and inserted together, so a double tap adds it once.
      return db.transaction(tx => {
        const rotation = tx
          .select({ id: rotations.id })
          .from(rotations)
          .where(stillThere(rotations, rotationId))
          .get();
        if (!rotation) throw new Error('No such Rotation');
        const template = tx
          .select({ name: templates.name })
          .from(templates)
          .where(stillThere(templates, templateId))
          .get();
        if (!template) throw new Error('No such Template');
        const already = tx
          .select({ id: rotationEntries.id })
          .from(rotationEntries)
          .where(
            and(
              eq(rotationEntries.rotationId, rotationId),
              eq(rotationEntries.templateId, templateId),
              notDeleted(rotationEntries),
            ),
          )
          .get();
        if (already) throw new Error(`${template.name} is already in that Rotation`);
        const position = positionAfterLast(
          tx,
          rotationEntries,
          rotationEntries.position,
          eq(rotationEntries.rotationId, rotationId),
        );
        return tx
          .insert(rotationEntries)
          .values({ rotationId, templateId, position })
          .returning({ id: rotationEntries.id })
          .get();
      });
    },

    async renameRotation(id: string, name: string): Promise<void> {
      const renamed = await db
        .update(rotations)
        .set({ name: requireRotationName(name) })
        .where(stillThere(rotations, id))
        .returning({ id: rotations.id });
      if (renamed.length === 0) throw new Error('No such Rotation');
    },

    // Soft delete: the others keep their positions, so their order holds.
    async removeTemplateFromRotation(rotationEntryId: string): Promise<void> {
      const removed = softDelete(
        db,
        rotationEntries,
        eq(rotationEntries.id, rotationEntryId),
        now(),
      );
      if (removed.length === 0) throw new Error('No such Template in a Rotation');
    },

    // Puts the Template at `toIndex` among the Rotation's Templates, counting
    // from 0, and shifts the ones in between along by one.
    async moveTemplateInRotation(rotationEntryId: string, toIndex: number): Promise<void> {
      db.transaction(tx => {
        const result = moveInList(
          tx,
          rotationEntries,
          rotationEntries.rotationId,
          rotationEntryId,
          toIndex,
        );
        if (result === 'no such row') throw new Error('No such Template in a Rotation');
        if (result === 'no such place') throw new Error('No such place in the Rotation');
      });
    },

    // Soft-deletes the Rotation with its entries, together. Workouts that
    // counted toward it keep saying so.
    async deleteRotation(id: string): Promise<void> {
      db.transaction(tx => {
        const deleted = softDelete(tx, rotations, eq(rotations.id, id), now(), { isActive: false });
        if (deleted.length === 0) throw new Error('No such Rotation');
      });
    },

    // Makes the Rotation the active one, the one next up comes from, in place
    // of any other. Null leaves none active.
    async setActiveRotation(id: string | null): Promise<void> {
      // Together, so there's never more than one, or none after a failure.
      db.transaction(tx => {
        tx.update(rotations).set({ isActive: false }).where(eq(rotations.isActive, true)).run();
        if (id === null) return;
        const activated = tx
          .update(rotations)
          .set({ isActive: true })
          .where(stillThere(rotations, id))
          .returning({ id: rotations.id })
          .all();
        if (activated.length === 0) throw new Error('No such Rotation');
      });
    },

    // Every Rotation, by name.
    getRotations(): Promise<Rotation[]> {
      return findRotations(undefined);
    },

    async getRotation(id: string): Promise<Rotation | undefined> {
      const [rotation] = await findRotations(eq(rotations.id, id));
      return rotation;
    },

    // The Template to do next from the active Rotation (see findNextUp).
    getNextUp(): Promise<Template | null> {
      return findNextUp();
    },
  };

  return { commands, idOfActiveRotationWith, findNextUp };
}
