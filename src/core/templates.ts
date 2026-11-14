// Templates and their Targets: what to aim for in each Exercise. What passes
// between a Template and the Workouts started from it is in
// template-workouts.ts.

import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

import { exerciseQueryColumns, type Exercise } from './exercises';
import { moveInList, notDeleted, positionAfterLast, softDelete, stillThere } from './records';
import { exercises, templateExercises, templates, type TrackingType, type WeightUnit } from './schema';
import type { TrackerDatabase } from './tracker';
import { displayWeightOf, problemWithWeight, type Weight } from './weights';

// What the lifter enters for a Target: sets × rep range @ weight, e.g.
// 3 × 8–12 @ 60 kg. The weight is kept in the unit it's entered in. For a
// bodyweight Exercise it's the added weight, as for a Set.
export type TargetValues = {
  sets: number;
  minReps: number;
  maxReps: number;
  weight: number | null;
  weightUnit: WeightUnit;
};

export type Target = TargetValues & {
  // What to show: the weight in the display unit, as for a Set.
  displayWeight: Weight | null;
};

// An Exercise in a Template, with what to aim for in it.
export type TemplateExercise = {
  id: string;
  exercise: Exercise;
  target: Target;
};

export type Template = {
  id: string;
  name: string;
  // In the order they're done.
  exercises: TemplateExercise[];
};

// Why a Target can't be set for an Exercise of this tracking type, or undefined
// when it can. Its weight follows the same rules as a Set's. The Template
// commands enforce it on Targets the lifter enters; ones taken from logged Sets
// meet it already. Screens use it to decide when to allow saving.
export function problemWithTarget(
  trackingType: TrackingType,
  { sets, minReps, maxReps, weight }: TargetValues,
): string | undefined {
  if (!Number.isInteger(sets) || sets < 1) {
    return 'A Target needs a whole number of sets, at least 1';
  }
  if (!Number.isInteger(minReps) || !Number.isInteger(maxReps) || minReps < 1) {
    return 'A rep range needs whole numbers of reps, at least 1';
  }
  if (minReps > maxReps) return "A rep range's minimum can't be more than its maximum";
  return problemWithWeight(trackingType, weight, 'Target');
}

function targetColumns({ sets, minReps, maxReps, weight, weightUnit }: TargetValues) {
  return {
    targetSets: sets,
    minReps,
    maxReps,
    targetWeight: weight,
    targetWeightUnit: weightUnit,
  };
}

// Back from a Template exercise row.
function targetOf(row: typeof templateExercises.$inferSelect): TargetValues {
  return {
    sets: row.targetSets,
    minReps: row.minReps,
    maxReps: row.maxReps,
    weight: row.targetWeight,
    weightUnit: row.targetWeightUnit,
  };
}

function requireValidTarget(trackingType: TrackingType, target: TargetValues) {
  const problem = problemWithTarget(trackingType, target);
  if (problem) throw new Error(problem);
}

// Adds an Exercise with its Target to a Template, at `position`, on its own or
// as part of a larger transaction.
export function insertTemplateExercise(
  tx: TrackerDatabase,
  {
    templateId,
    exerciseId,
    position,
    target,
  }: { templateId: string; exerciseId: string; position: number; target: TargetValues },
): { id: string } {
  return tx
    .insert(templateExercises)
    .values({ templateId, exerciseId, position, ...targetColumns(target) })
    .returning({ id: templateExercises.id })
    .get();
}

// A Template's name as it's saved, trimmed; refused when blank.
export function requireTemplateName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Template needs a name');
  return name;
}

type TemplateDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  getDisplayUnit: () => Promise<WeightUnit>;
};

export type Templates = ReturnType<typeof createTemplates>;

export function createTemplates({ db, now, getDisplayUnit }: TemplateDependencies) {
  // The Templates matching `where`, each with its Exercises in order. Deleted
  // Templates and removed Exercises are left out.
  async function findTemplates(where: SQL | undefined): Promise<Template[]> {
    const found = await db.query.templates.findMany({
      where: and(where, notDeleted(templates)),
      orderBy: sql`${templates.name} COLLATE NOCASE`,
      columns: { id: true, name: true },
      with: {
        exercises: {
          where: notDeleted(templateExercises),
          orderBy: asc(templateExercises.position),
          with: { exercise: { columns: exerciseQueryColumns } },
        },
      },
    });
    const displayUnit = await getDisplayUnit();
    return found.map(template => ({
      id: template.id,
      name: template.name,
      exercises: template.exercises.map(row => {
        const target = targetOf(row);
        return {
          id: row.id,
          exercise: row.exercise,
          target: {
            ...target,
            displayWeight: displayWeightOf(target.weight, target.weightUnit, displayUnit),
          },
        };
      }),
    }));
  }

  // Undefined once it's deleted.
  async function findTemplate(id: string): Promise<Template | undefined> {
    const [template] = await findTemplates(eq(templates.id, id));
    return template;
  }

  const commands = {
    async createTemplate(name: string): Promise<{ id: string }> {
      return db
        .insert(templates)
        .values({ name: requireTemplateName(name) })
        .returning({ id: templates.id })
        .get();
    },

    async renameTemplate(id: string, name: string): Promise<void> {
      const renamed = await db
        .update(templates)
        .set({ name: requireTemplateName(name) })
        .where(stillThere(templates, id))
        .returning({ id: templates.id });
      if (renamed.length === 0) throw new Error('No such Template');
    },

    // Soft-deletes the Template with its Exercises, together, and takes it out
    // of every Rotation.
    async deleteTemplate(id: string): Promise<void> {
      db.transaction(tx => {
        const deleted = softDelete(tx, templates, eq(templates.id, id), now());
        if (deleted.length === 0) throw new Error('No such Template');
      });
    },

    // Appends the Exercise after the ones already in the Template.
    async addExerciseToTemplate(
      templateId: string,
      exerciseId: string,
      target: TargetValues,
    ): Promise<{ id: string }> {
      const [template] = await db
        .select({ id: templates.id })
        .from(templates)
        .where(stillThere(templates, templateId));
      if (!template) throw new Error('No such Template');
      // Hidden Exercises already in a Template stay; new ones come from the library.
      const [exercise] = await db
        .select({ trackingType: exercises.trackingType })
        .from(exercises)
        .where(and(eq(exercises.id, exerciseId), notDeleted(exercises)));
      if (!exercise) throw new Error('No such Exercise in the library');
      requireValidTarget(exercise.trackingType, target);
      const position = positionAfterLast(
        db,
        templateExercises,
        templateExercises.position,
        eq(templateExercises.templateId, templateId),
      );
      return insertTemplateExercise(db, { templateId, exerciseId, position, target });
    },

    // Checked against the Exercise's tracking type, like a new Target.
    async editTarget(templateExerciseId: string, target: TargetValues): Promise<void> {
      const [row] = await db
        .select({ trackingType: exercises.trackingType })
        .from(templateExercises)
        .innerJoin(exercises, eq(templateExercises.exerciseId, exercises.id))
        .where(stillThere(templateExercises, templateExerciseId));
      if (!row) throw new Error('No such Exercise in a Template');
      requireValidTarget(row.trackingType, target);
      const changed = await db
        .update(templateExercises)
        .set(targetColumns(target))
        .where(stillThere(templateExercises, templateExerciseId))
        .returning({ id: templateExercises.id });
      // Removed while its Exercise was being looked up.
      if (changed.length === 0) throw new Error('No such Exercise in a Template');
    },

    // Soft delete: the others keep their positions, so their order holds.
    async removeExerciseFromTemplate(templateExerciseId: string): Promise<void> {
      const removed = softDelete(
        db,
        templateExercises,
        eq(templateExercises.id, templateExerciseId),
        now(),
      );
      if (removed.length === 0) throw new Error('No such Exercise in a Template');
    },

    // Puts the Exercise at `toIndex` among the Template's Exercises, counting
    // from 0, and shifts the ones in between along by one.
    async moveTemplateExercise(templateExerciseId: string, toIndex: number): Promise<void> {
      db.transaction(tx => {
        const result = moveInList(
          tx,
          templateExercises,
          templateExercises.templateId,
          templateExerciseId,
          toIndex,
        );
        if (result === 'no such row') throw new Error('No such Exercise in a Template');
        if (result === 'no such place') throw new Error('No such place in the Template');
      });
    },

    // Every Template, by name.
    getTemplates(): Promise<Template[]> {
      return findTemplates(undefined);
    },

    async getTemplate(id: string): Promise<Template | undefined> {
      const [template] = await findTemplates(eq(templates.id, id));
      return template;
    },
  };

  return { commands, findTemplates, findTemplate };
}
