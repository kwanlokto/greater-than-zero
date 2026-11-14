// Template workouts: Workouts started from a Template, and everything that
// passes between a Workout and a Template. Planning a new Workout's Sets from
// the Targets, pairing its entries with the Template's Exercises, the hint to
// go heavier, the offers made when it finishes, and the Template commands that
// follow a finished Workout all live here, so the pairing never leaves.

import { and, eq, inArray, isNotNull, notInArray } from 'drizzle-orm';

import type { Exercise } from './exercises';
import { softDelete, stillThere } from './records';
import {
  exerciseEntries,
  exercises,
  templateExercises,
  templates,
  workouts,
  type WeightUnit,
} from './schema';
import { finished, workingSetsOf, type SessionHistory, type WorkoutPlace } from './session-history';
import {
  insertTemplateExercise,
  requireTemplateName,
  type Target,
  type TargetValues,
  type Template,
  type TemplateExercise,
  type Templates,
} from './templates';
import type { TrackerDatabase } from './tracker';
import { displayWeightOf, isAtLeast, isHeavier, lightestOf, type Weight } from './weights';
import type { WorkoutReads } from './workout-reads';
import type { ExerciseEntry, Workout, WorkoutSet } from './workouts';

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

// What finishing a Workout brings from its Template: the offers to put to the
// lifter, and the pairing to record as it finishes. Nothing for a Workout
// started empty, or from a Template since deleted.
export type Finishing = {
  // The Template, when the Workout's Exercise list no longer matches it.
  templateUpdateOffer: { templateId: string; templateName: string } | null;
  // A higher Target for each Exercise whose session beat it.
  targetUpdateOffers: TargetUpdateOffer[];
  // Records which Template exercise each entry was done for, in the finish's
  // own transaction, so later sessions under the Template can tell apart two
  // copies of one Exercise.
  recordPairing(tx: TrackerDatabase): void;
};

// The Template a Workout started from, and which of its Exercises each entry
// was done for, by entry ID (see pairWithTemplate).
type TemplatePairing = {
  template: Template;
  pairs: Map<string, TemplateExercise>;
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

type Dependencies = {
  db: TrackerDatabase;
  now: () => Date;
  getDisplayUnit: () => Promise<WeightUnit>;
  history: SessionHistory;
  templates: Pick<Templates, 'findTemplate'>;
  reads: Pick<WorkoutReads, 'findWorkouts'>;
};

export type TemplateWorkouts = ReturnType<typeof createTemplateWorkouts>;

export function createTemplateWorkouts({
  db,
  now,
  getDisplayUnit,
  history,
  templates: { findTemplate },
  reads: { findWorkouts },
}: Dependencies) {
  // Pairs each of a Workout's entries with the Exercise in its Template it was
  // done for. An entry takes the Template exercise it was copied from, if it's
  // still in the Template. One that lost that link, by being swapped away and
  // back or removed and added again, then takes the first one left of the same
  // Exercise, so it keeps its Target. Entries added or swapped in have none.
  // Finishing records the pairs on the entries, which is how latestSessionFor
  // tells apart two copies of one Exercise in later sessions.
  async function pairWithTemplate(
    workout: Workout,
    template: Template,
  ): Promise<Map<string, TemplateExercise>> {
    const links = await db
      .select({ id: exerciseEntries.id, templateExerciseId: exerciseEntries.templateExerciseId })
      .from(exerciseEntries)
      .where(eq(exerciseEntries.workoutId, workout.id));
    const linkOf = new Map(links.map(link => [link.id, link.templateExerciseId]));
    const unpaired = new Map(template.exercises.map(exercise => [exercise.id, exercise]));
    const pairs = new Map<string, TemplateExercise>();
    const pair = (entryId: string, templateExercise: TemplateExercise) => {
      pairs.set(entryId, templateExercise);
      unpaired.delete(templateExercise.id);
    };
    for (const entry of workout.entries) {
      const linked = unpaired.get(linkOf.get(entry.id) ?? '');
      if (linked) pair(entry.id, linked);
    }
    for (const entry of workout.entries) {
      if (pairs.has(entry.id)) continue;
      const same = [...unpaired.values()].find(({ exercise }) => exercise.id === entry.exercise.id);
      if (same) pair(entry.id, same);
    }
    return pairs;
  }

  // Null for a Workout started empty, or from a Template since deleted.
  async function pairingOf(workout: Workout): Promise<TemplatePairing | null> {
    if (!workout.templateId) return null;
    const template = await findTemplate(workout.templateId);
    if (!template) return null;
    return { template, pairs: await pairWithTemplate(workout, template) };
  }

  async function findFinishedWorkout(id: string): Promise<Workout> {
    const [workout] = await findWorkouts(and(eq(workouts.id, id), finished()));
    if (!workout) throw new Error('No such finished Workout');
    return workout;
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

  // See EntryToLog.readyToGoHeavier.
  async function exerciseReadyToGoHeavier(
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

  const commands = {
    // Makes the Exercise list of the Template a finished Workout started from
    // match the Workout, when the lifter accepts. Exercises the Template already
    // had keep their Targets; new ones take theirs from what was done.
    async updateTemplateFromWorkout(workoutId: string): Promise<void> {
      const workout = await findFinishedWorkout(workoutId);
      const pairing = await pairingOf(workout);
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
      const workout = await findFinishedWorkout(workoutId);
      const pairing = await pairingOf(workout);
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
    // Target taken from what was done (see newTemplateExercisesFrom). Any
    // finished Workout will do, including one started empty.
    async saveWorkoutAsTemplate(workoutId: string, name: string): Promise<{ id: string }> {
      const templateName = requireTemplateName(name);
      const workout = await findFinishedWorkout(workoutId);
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
  };

  return {
    commands,

    // What starting a Template adds, for a Workout about to start: its
    // Exercises in order, each with the target number of Sets at the Target
    // weight. Reps come from the Set in the same position among last session's
    // working Sets, or the bottom of the rep range when there isn't one. An
    // Exercise the Template holds more than once counts positions on from one
    // to the next, as last session's Sets of it were logged.
    async plan(templateId: string, workout: WorkoutPlace) {
      const template = await findTemplate(templateId);
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
    },

    // The entries of a Workout ready to go heavier (see
    // EntryToLog.readyToGoHeavier), by ID. Only a Workout in progress gets
    // the hint.
    async readyToGoHeavier(workout: Workout): Promise<Set<string>> {
      const ready = new Set<string>();
      const pairing = workout.finishedAt === null ? await pairingOf(workout) : null;
      if (!pairing) return ready;
      for (const entry of workout.entries) {
        const templateExercise = pairing.pairs.get(entry.id);
        if (
          templateExercise &&
          (await exerciseReadyToGoHeavier(pairing.template, templateExercise, workout))
        ) {
          ready.add(entry.id);
        }
      }
      return ready;
    },

    // What finishing a Workout brings from its Template (see Finishing),
    // worked out before it finishes.
    async finishing(workout: Workout): Promise<Finishing> {
      const pairing = await pairingOf(workout);
      if (!pairing) {
        return { templateUpdateOffer: null, targetUpdateOffers: [], recordPairing: () => {} };
      }
      const update = await templateUpdateFor(workout, pairing);
      return {
        templateUpdateOffer: update.differs
          ? { templateId: update.templateId, templateName: update.templateName }
          : null,
        targetUpdateOffers: await targetUpdateOffersFor(workout, pairing),
        recordPairing(tx) {
          pairing.pairs.forEach((templateExercise, entryId) => {
            tx.update(exerciseEntries)
              .set({ templateExerciseId: templateExercise.id })
              // Unless it was swapped for another Exercise meanwhile.
              .where(
                and(
                  eq(exerciseEntries.id, entryId),
                  eq(exerciseEntries.exerciseId, templateExercise.exercise.id),
                ),
              )
              .run();
          });
        },
      };
    },
  };
}
