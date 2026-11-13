// Templates and their Targets: what to aim for in each Exercise, starting a
// Workout from one, and what a finished Workout offers to change in it.

import { and, asc, eq, inArray, isNotNull, notInArray, sql, type SQL } from 'drizzle-orm';

import { exerciseQueryColumns, type Exercise } from './exercises';
import { moveInList, notDeleted, positionAfterLast, softDelete, stillThere } from './records';
import {
  exerciseEntries,
  exercises,
  templateExercises,
  templates,
  workouts,
  type TrackingType,
  type WeightUnit,
} from './schema';
import {
  finished,
  workingSetsOf,
  type SessionHistory,
  type TemplatePairing,
  type WorkoutPlace,
} from './session-history';
import type { TrackerDatabase } from './tracker';
import {
  displayWeightOf,
  isAtLeast,
  isHeavier,
  lightestOf,
  problemWithWeight,
  type Weight,
} from './weights';
import type { ExerciseEntry, Workout, WorkoutSet } from './workouts';

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

// An offer to raise the Target weight of an Exercise in a Template, after a
// session that beat it.
export type TargetUpdateOffer = {
  templateExerciseId: string;
  exercise: Exercise;
  // The Target as it is.
  target: Target;
  // The proposed Target weight: the lightest working Set's, as entered.
  weight: number | null;
  weightUnit: WeightUnit;
  // For showing only.
  displayWeight: Weight | null;
};

// An Exercise for a Template, with a Target taken from what was done.
type NewTemplateExercise = { exerciseId: string; target: TargetValues };

// The Exercise list a Template would take to match a Workout, each one either
// already in it or new, and whether that differs from the list it has.
type TemplateUpdate = {
  templateId: string;
  templateName: string;
  // A new one names the entry it's taken from.
  exercises: ({ templateExerciseId: string } | (NewTemplateExercise & { entryId: string }))[];
  differs: boolean;
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

// Whether a session's working Sets were at least the Target's number of sets,
// every one meeting `rule`: the shape of both the Target update offer and the
// "ready to go heavier" hint.
function setsMeetTarget<S>(workingSets: S[], target: TargetValues, rule: (set: S) => boolean) {
  return workingSets.length >= target.sets && workingSets.every(rule);
}

// The Target weight a session earned: when it had at least the Target's number
// of working Sets, every one heavier than the Target weight with at least the
// rep-range minimum, it's the lightest of them, as entered. Undefined for a
// session that didn't beat the Target, which never changes it. Warm-ups don't
// count.
function raisedTargetWeight(
  target: TargetValues,
  loggedSets: WorkoutSet[],
): Pick<TargetValues, 'weight' | 'weightUnit'> | undefined {
  const working = workingSetsOf(loggedSets);
  const beatIt = setsMeetTarget(
    working,
    target,
    set => isHeavier(set, target) && set.reps >= target.minReps,
  );
  if (!beatIt) return undefined;
  const { weight, weightUnit } = lightestOf(working);
  return { weight, weightUnit };
}

// A Target taken from what was done in an Exercise: as many sets as working
// Sets logged, their lowest to highest reps, at the lightest working weight as
// it was entered. Undefined with no working Set, as a Target needs one.
function targetFromSets(loggedSets: WorkoutSet[]): TargetValues | undefined {
  const working = workingSetsOf(loggedSets);
  if (working.length === 0) return undefined;
  const reps = working.map(set => set.reps);
  const lightest = lightestOf(working);
  return {
    sets: working.length,
    minReps: Math.min(...reps),
    maxReps: Math.max(...reps),
    weight: lightest.weight,
    weightUnit: lightest.weightUnit,
  };
}

function requireValidTarget(trackingType: TrackingType, target: TargetValues) {
  const problem = problemWithTarget(trackingType, target);
  if (problem) throw new Error(problem);
}

function requireTemplateName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Template needs a name');
  return name;
}

type TemplateDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  getDisplayUnit: () => Promise<WeightUnit>;
  history: SessionHistory;
  // Workouts' own read, for the finished Workouts a Template changes from.
  findWorkouts: (where: SQL | undefined) => Promise<Workout[]>;
};

export type Templates = ReturnType<typeof createTemplates>;

export function createTemplates({
  db,
  now,
  getDisplayUnit,
  history,
  findWorkouts,
}: TemplateDependencies) {
  // What starting a Template adds, for a Workout about to start: its Exercises
  // in order, each with the target number of Sets at the Target weight. Reps
  // come from the Set in the same position among last session's working Sets,
  // or the bottom of the rep range when there isn't one. An Exercise the
  // Template holds more than once counts positions on from one to the next,
  // as last session's Sets of it were logged.
  async function planFromTemplate(templateId: string, workout: WorkoutPlace) {
    const [template] = await findTemplates(eq(templates.id, templateId));
    if (!template) throw new Error('No such Template');
    const lastSets = new Map<string, WorkoutSet[]>();
    const setsPlanned = new Map<string, number>();
    const plan = [];
    for (const { id, exercise, target } of template.exercises) {
      if (!lastSets.has(exercise.id)) {
        const lastTime = await history.lastTime(exercise.id, workout);
        lastSets.set(exercise.id, lastTime?.sets ?? []);
      }
      const last = lastSets.get(exercise.id) ?? [];
      const first = setsPlanned.get(exercise.id) ?? 0;
      setsPlanned.set(exercise.id, first + target.sets);
      plan.push({
        exerciseId: exercise.id,
        templateExerciseId: id,
        sets: Array.from({ length: target.sets }, (_, index) => ({
          weight: target.weight,
          weightUnit: target.weightUnit,
          reps: last[first + index]?.reps ?? target.minReps,
        })),
      });
    }
    return plan;
  }

  // Adds an Exercise with its Target to a Template, at `position`, on its own or
  // as part of a larger transaction.
  function insertTemplateExercise(
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

  // What the Template's Exercise list would become to match the Workout: its
  // Exercises in the Workout's order. Each is the Template exercise it's paired
  // with, keeping its Target, even if nothing was logged for it; or one new to
  // the Template (see newTemplateExercisesFrom).
  async function templateUpdateFor(
    workout: Workout,
    { template, pairs }: TemplatePairing,
  ): Promise<TemplateUpdate> {
    const newExercises = await newTemplateExercisesFrom(workout.entries);
    const exercises: TemplateUpdate['exercises'] = [];
    for (const entry of workout.entries) {
      const paired = pairs.get(entry.id);
      const newExercise = newExercises.get(entry.id);
      if (paired) exercises.push({ templateExerciseId: paired.id });
      else if (newExercise) exercises.push({ ...newExercise, entryId: entry.id });
    }
    const differs =
      exercises.length !== template.exercises.length ||
      exercises.some(
        (exercise, index) =>
          !('templateExerciseId' in exercise) ||
          exercise.templateExerciseId !== template.exercises[index].id,
      );
    return { templateId: template.id, templateName: template.name, exercises, differs };
  }

  // An offer for each Exercise whose session beat the Target it's paired with,
  // in the Workout's order (see raisedTargetWeight).
  async function targetUpdateOffersFor(
    workout: Workout,
    { pairs }: TemplatePairing,
  ): Promise<TargetUpdateOffer[]> {
    const displayUnit = await getDisplayUnit();
    return workout.entries.flatMap(entry => {
      const paired = pairs.get(entry.id);
      const raised = paired && raisedTargetWeight(paired.target, entry.sets);
      if (!paired || !raised) return [];
      return [
        {
          templateExerciseId: paired.id,
          exercise: entry.exercise,
          target: paired.target,
          ...raised,
          displayWeight: displayWeightOf(raised.weight, raised.weightUnit, displayUnit),
        },
      ];
    });
  }

  // Each entry's Exercise as a new Template exercise, with a Target taken from
  // what was done, by entry ID, in the entries' order. Left out: an entry with
  // no working Set to take a Target from, and one whose Exercise has since been
  // hidden, as Templates take theirs from the library.
  async function newTemplateExercisesFrom(
    entries: ExerciseEntry[],
  ): Promise<Map<string, NewTemplateExercise>> {
    const exerciseIds = entries.map(entry => entry.exercise.id);
    const hidden = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(inArray(exercises.id, exerciseIds), isNotNull(exercises.deletedAt)));
    const hiddenIds = new Set(hidden.map(({ id }) => id));
    const newExercises = new Map<string, NewTemplateExercise>();
    for (const entry of entries) {
      const target = targetFromSets(entry.sets);
      if (target && !hiddenIds.has(entry.exercise.id)) {
        newExercises.set(entry.id, { exerciseId: entry.exercise.id, target });
      }
    }
    return newExercises;
  }

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

  // See EntryToLog.readyToGoHeavier.
  async function readyToGoHeavier(
    template: Template,
    templateExercise: TemplateExercise,
    workout: Workout,
  ): Promise<boolean> {
    const workingSets = await history.latestSessionFor(template, templateExercise, workout);
    const { target } = templateExercise;
    return (
      workingSets !== undefined &&
      setsMeetTarget(
        workingSets,
        target,
        set => isAtLeast(set, target) && set.reps >= target.maxReps,
      )
    );
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

    // Makes the Exercise list of the Template a finished Workout started from
    // match the Workout, when the lifter accepts. Exercises the Template already
    // had keep their Targets; new ones take theirs from what was done.
    async updateTemplateFromWorkout(workoutId: string): Promise<void> {
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const pairing = await history.pairing(workout);
      if (!pairing) throw new Error('That Workout has no Template to update');
      const update = await templateUpdateFor(workout, pairing);
      const { templateId } = update;
      const deletedAt = now();
      db.transaction(tx => {
        // Checked again, as it may have been deleted since.
        const template = tx
          .select({ id: templates.id })
          .from(templates)
          .where(stillThere(templates, templateId))
          .get();
        if (!template) throw new Error('That Workout has no Template to update');
        const kept = update.exercises.flatMap(exercise =>
          'templateExerciseId' in exercise ? [exercise.templateExerciseId] : [],
        );
        softDelete(
          tx,
          templateExercises,
          and(eq(templateExercises.templateId, templateId), notInArray(templateExercises.id, kept)),
          deletedAt,
        );
        update.exercises.forEach((exercise, position) => {
          if ('templateExerciseId' in exercise) {
            tx.update(templateExercises)
              .set({ position })
              // Not one removed from the Template since.
              .where(stillThere(templateExercises, exercise.templateExerciseId))
              .run();
          } else {
            const { entryId, ...newExercise } = exercise;
            const created = insertTemplateExercise(tx, { templateId, position, ...newExercise });
            // So later sessions under the Template find which one it was done for.
            tx.update(exerciseEntries)
              .set({ templateExerciseId: created.id })
              .where(eq(exerciseEntries.id, entryId))
              .run();
          }
        });
      });
    },

    // Raises the Target weight of one Exercise in the Template a finished
    // Workout started from, to what its offer proposes. The offer is worked out
    // again, so only a session that beat the Target changes it. Nothing else
    // about the Target changes.
    async acceptTargetUpdate(workoutId: string, templateExerciseId: string): Promise<void> {
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const pairing = await history.pairing(workout);
      const offers = pairing ? await targetUpdateOffersFor(workout, pairing) : [];
      const offer = offers.find(candidate => candidate.templateExerciseId === templateExerciseId);
      if (!offer) throw new Error("That session didn't beat the Target");
      const raised = await db
        .update(templateExercises)
        .set({ targetWeight: offer.weight, targetWeightUnit: offer.weightUnit })
        .where(stillThere(templateExercises, templateExerciseId))
        .returning({ id: templateExercises.id });
      if (raised.length === 0) throw new Error('No such Exercise in a Template');
    },

    // A new Template of a finished Workout's Exercises, in order, each with a
    // Target taken from what was done (see newTemplateExercisesFrom).
    async saveWorkoutAsTemplate(workoutId: string, name: string): Promise<{ id: string }> {
      const templateName = requireTemplateName(name);
      const [workout] = await findWorkouts(and(eq(workouts.id, workoutId), finished()));
      if (!workout) throw new Error('No such finished Workout');
      const exercisesDone = [...(await newTemplateExercisesFrom(workout.entries)).values()];
      return db.transaction(tx => {
        const template = tx
          .insert(templates)
          .values({ name: templateName })
          .returning({ id: templates.id })
          .get();
        exercisesDone.forEach((exercise, position) => {
          insertTemplateExercise(tx, { templateId: template.id, position, ...exercise });
        });
        return template;
      });
    },

    async getTemplate(id: string): Promise<Template | undefined> {
      const [template] = await findTemplates(eq(templates.id, id));
      return template;
    },
  };

  return {
    commands,
    findTemplates,
    findTemplate,
    planFromTemplate,
    templateUpdateFor,
    targetUpdateOffersFor,
    readyToGoHeavier,
  };
}
