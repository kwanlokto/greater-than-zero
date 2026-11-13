// How an Exercise has progressed: one value per finished Workout.

import { eq, inArray } from 'drizzle-orm';

import { exerciseColumns, type Exercise } from './exercises';
import { exercises, type TrackingType, type WeightUnit } from './schema';
import type { SessionHistory } from './session-history';
import type { TrackerDatabase } from './tracker';
import { convertWeight, roundedForDisplay } from './weights';

// How an Exercise has progressed: one value per finished Workout.

// What a progress chart measures in each Workout's working Sets of an
// Exercise: the best estimated one-rep max, the heaviest weight (for a
// bodyweight Exercise, its added weight), or the most reps.
export type ProgressMeasure = 'estimatedOneRepMax' | 'heaviestWeight' | 'mostReps';

// The two a chart offers for each kind of Exercise: the one it shows first,
// and the one it switches to.
export const progressMeasuresFor: Record<TrackingType, [ProgressMeasure, ProgressMeasure]> = {
  weighted: ['estimatedOneRepMax', 'heaviestWeight'],
  bodyweight: ['mostReps', 'heaviestWeight'],
};

// A finished Workout on a progress chart.
export type ProgressPoint = {
  workoutId: string;
  // Its local date, as YYYY-MM-DD.
  localDate: string;
  // At full precision, for plotting.
  value: number;
  // What to show: a weight to one decimal place, like a Set's, or reps.
  displayValue: number;
};

// A progress chart: its points in the order Workouts go in, and the unit of
// their values: the display unit for weights, or reps.
export type ProgressSeries = {
  unit: WeightUnit | 'reps';
  points: ProgressPoint[];
};

// Epley's estimate of the most that could be lifted once: weight × (1 + reps ÷
// 30). A Set of 1 rep is its own weight.
export function estimatedOneRepMax(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// What a measure's values are in: reps, or weights in the display unit.
export function unitOf(measure: ProgressMeasure, displayUnit: WeightUnit): ProgressSeries['unit'] {
  return measure === 'mostReps' ? 'reps' : displayUnit;
}

// A Workout's value for a measure: the best of its working Sets of the
// Exercise, each weight in the unit charted. Plain bodyweight, stored as null,
// is no added weight.
export function bestValueOf(
  measure: ProgressMeasure,
  workingSets: { weight: number | null; reps: number }[],
): number {
  const values = workingSets.map(({ weight, reps }) => {
    if (measure === 'estimatedOneRepMax') return estimatedOneRepMax(weight ?? 0, reps);
    if (measure === 'heaviestWeight') return weight ?? 0;
    return reps;
  });
  return Math.max(...values);
}

type ProgressDependencies = {
  db: TrackerDatabase;
  history: SessionHistory;
  getDisplayUnit: () => Promise<WeightUnit>;
};

export function createProgress({ db, history, getDisplayUnit }: ProgressDependencies) {
  const commands = {
    // The Exercises there's progress to chart for: those with a working Set
    // in a finished Workout, the one whose latest such Workout comes last in
    // the order Workouts go in first. Hidden ones keep their history, so
    // they're here too.
    async getProgressExercises(): Promise<Exercise[]> {
      const ids = await history.exercisesDoneLatestFirst();
      const found = await db
        .select(exerciseColumns)
        .from(exercises)
        .where(inArray(exercises.id, ids));
      const byId = new Map(found.map(exercise => [exercise.id, exercise]));
      return ids.flatMap(id => byId.get(id) ?? []);
    },

    // A progress chart for an Exercise: a point for each finished Workout with
    // a working Set of it, in the order Workouts go in, valued by `measure`
    // across that Workout's working Sets of it. Weights are converted from
    // each Set as entered to the display unit, at full precision.
    async getProgress(exerciseId: string, measure: ProgressMeasure): Promise<ProgressSeries> {
      const [exercise] = await db
        .select({ trackingType: exercises.trackingType })
        .from(exercises)
        .where(eq(exercises.id, exerciseId));
      if (!exercise) throw new Error('No such Exercise');
      // Each kind of Exercise has its own two (see progressMeasuresFor).
      if (!progressMeasuresFor[exercise.trackingType].includes(measure)) {
        throw new Error(`A ${exercise.trackingType} Exercise isn't charted that way`);
      }
      const workingSets = await history.workingSetsDone(exerciseId);
      const displayUnit = await getDisplayUnit();
      const unit = unitOf(measure, displayUnit);
      // Each Workout's Sets, Workouts in the order their first Set came.
      const byWorkout = new Map<string, { localDate: string; sets: typeof workingSets }>();
      for (const set of workingSets) {
        const workout = byWorkout.get(set.workoutId) ?? { localDate: set.localDate, sets: [] };
        workout.sets.push(set);
        byWorkout.set(set.workoutId, workout);
      }
      const points: ProgressPoint[] = [...byWorkout].map(([workoutId, workout]) => {
        const value = bestValueOf(
          measure,
          workout.sets.map(({ weight, weightUnit, reps }) => ({
            weight: weight === null ? null : convertWeight(weight, weightUnit, displayUnit),
            reps,
          })),
        );
        const displayValue = unit === 'reps' ? value : roundedForDisplay(value);
        return { workoutId, localDate: workout.localDate, value, displayValue };
      });
      return { unit, points };
    },
  };

  return { commands };
}
