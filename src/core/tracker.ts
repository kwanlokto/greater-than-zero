// The tracker core: every command and query the app has, behind one
// interface, createTracker. Each area lives in its own module; this one puts
// them together and says what callers can use.

import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { createBackup } from './backup';
import { createBodyWeight, type WeighIn } from './body-weight';
import { createExercises } from './exercises';
import { createFood, type Meal } from './food';
import { createProgress } from './progress';
import { createRotations } from './rotations';
import * as schema from './schema';
import { workouts } from './schema';
import { createSessionHistory, finished } from './session-history';
import { createSettings } from './settings';
import { createTemplates } from './templates';
import { createWorkouts, type Workout } from './workouts';

export { schema };
export type { BackupFile, BackupSummary } from './backup';
export {
  problemWithWeighIn,
  type BodyWeightPoint,
  type BodyWeightTrend,
  type WeighIn,
} from './body-weight';
export {
  type Exercise,
  type ExerciseChanges,
  type ExerciseSearch,
  type NewExercise,
} from './exercises';
export {
  caloriesFromMacros,
  portionOf,
  problemWithFoodItem,
  problemWithMacroTargets,
  problemWithPortion,
  problemWithSavedFood,
  type DailyTotals,
  type FoodItem,
  type FoodItemValues,
  type FoodValues,
  type Macro,
  type MacroProgress,
  type MacroTargets,
  type Macros,
  type Meal,
  type SavedFood,
  type SavedFoodValues,
  type TimeOfDay,
} from './food';
export { localDateOf } from './local-dates';
export {
  progressMeasuresFor,
  type ProgressMeasure,
  type ProgressPoint,
  type ProgressSeries,
} from './progress';
export { canAddToRotation, type Rotation, type RotationEntry } from './rotations';
export {
  muscleGroups,
  trackingTypes,
  weightUnits,
  type MuscleGroup,
  type TrackingType,
  type WeightUnit,
} from './schema';
export {
  problemWithTarget,
  type Target,
  type TargetUpdateOffer,
  type TargetValues,
  type Template,
  type TemplateExercise,
} from './templates';
export { describeLoad, describeSet, formatWeight, type Weight } from './weights';
export {
  canAddWorkoutOn,
  canFinishWorkout,
  canSwapExercise,
  problemWithSet,
  restSecondsLeft,
  type EntryToLog,
  type ExerciseEntry,
  type FinishSummary,
  type LastTime,
  type NewWorkout,
  type PlannedSet,
  type SetValues,
  type Workout,
  type WorkoutSet,
  type WorkoutToLog,
} from './workouts';

// Drizzle over expo-sqlite in the app, over better-sqlite3 in tests.
export type TrackerDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Tracker = ReturnType<typeof createTracker>;

// What was recorded on one of the phone's local calendar dates.
export type Day = {
  // As YYYY-MM-DD.
  localDate: string;
  // Its finished Workouts, in the order Workouts go in.
  workouts: Workout[];
  // Its Meals, in the order eaten.
  meals: Meal[];
  // Null when none was entered that day.
  weighIn: WeighIn | null;
};

export type TrackerOptions = {
  // The clock; tests pass their own.
  now?: () => Date;
};

export function createTracker(
  db: TrackerDatabase,
  { now = () => new Date() }: TrackerOptions = {},
) {
  const settings = createSettings(db);
  const { getDisplayUnit } = settings;
  // Session history and Templates read from each other, as do Templates and
  // Workouts, so each is handed the other's read as a function it calls once
  // both exist.
  const history = createSessionHistory(db, {
    getDisplayUnit,
    findTemplate: id => templateArea.findTemplate(id),
  });
  const templateArea = createTemplates({
    db,
    now,
    getDisplayUnit,
    history,
    findWorkouts: where => workoutArea.findWorkouts(where),
  });
  const rotationArea = createRotations({
    db,
    now,
    history,
    findTemplates: templateArea.findTemplates,
  });
  const workoutArea = createWorkouts({
    db,
    now,
    history,
    getDisplayUnit,
    getFallbackRestSeconds: settings.getFallbackRestSeconds,
    templates: templateArea,
    rotations: rotationArea,
  });
  const foodArea = createFood({ db, now, getMacroTargets: settings.getMacroTargets });
  const bodyWeightArea = createBodyWeight({ db, now, getDisplayUnit });
  const { findWorkouts } = workoutArea;
  const { mealsOn } = foodArea;
  const { getWeighIn } = bodyWeightArea;

  return {
    ...settings.commands,
    ...createExercises({ db, now }).commands,
    ...workoutArea.commands,
    ...templateArea.commands,
    ...rotationArea.commands,

    // A day as History shows it, from three areas at once.
    async getDay(localDate: string): Promise<Day> {
      return {
        localDate,
        workouts: await findWorkouts(and(eq(workouts.localDate, localDate), finished())),
        meals: await mealsOn(localDate),
        weighIn: await getWeighIn(localDate),
      };
    },

    ...createBackup({ db, now }).commands,
    ...foodArea.commands,
    ...createProgress({ db, history, getDisplayUnit }).commands,
    ...bodyWeightArea.commands,
  };
}
