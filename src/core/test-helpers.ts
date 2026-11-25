import type {
  FoodItemValues,
  NewWorkout,
  SetValues,
  Tracker,
  WeightUnit,
} from './tracker';

export function names(items: { name: string }[]) {
  return items.map(item => item.name);
}

export async function findExerciseByName(tracker: Tracker, name: string) {
  const found = await tracker.searchExercises({ query: name });
  const exercise = found.find(candidate => candidate.name === name);
  if (!exercise) throw new Error(`No Exercise named ${name}`);
  return exercise;
}

// Starts a Workout with these Exercises, in order.
export async function startWorkoutWithEach(
  tracker: Tracker,
  exerciseNames: string[],
  start?: NewWorkout,
) {
  const workout = await tracker.startWorkout(start);
  const entries = [];
  for (const name of exerciseNames) {
    const exercise = await findExerciseByName(tracker, name);
    entries.push(await tracker.addExerciseToWorkout(workout.id, exercise.id));
  }
  return { workout, entries };
}

// Starts a Workout with one Exercise in it.
export async function startWorkoutWith(tracker: Tracker, exerciseName: string, start?: NewWorkout) {
  const { workout, entries } = await startWorkoutWithEach(tracker, [exerciseName], start);
  return { workout, entry: entries[0] };
}

// A Workout's Exercises, in order.
export async function entriesOf(tracker: Tracker, workoutId: string) {
  return (await tracker.getWorkout(workoutId))?.entries ?? [];
}

// An Exercise in a Workout as its reads hand it back, with Last time and the
// "ready to go heavier" hint.
export async function entryToLog(tracker: Tracker, workoutId: string, entryId: string) {
  const entry = (await entriesOf(tracker, workoutId)).find(({ id }) => id === entryId);
  if (!entry) throw new Error('No such Exercise in the Workout');
  return entry;
}

// The Sets of a Workout's first Exercise.
export async function setsOf(tracker: Tracker, workoutId: string) {
  const [entry] = await entriesOf(tracker, workoutId);
  return entry.sets;
}

// A clock the test moves by hand.
export function clockAt(time: string) {
  let current = new Date(time);
  return {
    now: () => current,
    setTime(next: string) {
      current = new Date(next);
    },
  };
}

// Starts, logs and finishes a Workout with one Exercise, its Sets in
// `weightUnit`.
export async function doWorkout(
  tracker: Tracker,
  exerciseName: string,
  loggedSets: SetValues[],
  weightUnit: WeightUnit = 'kg',
) {
  const { workout, entry } = await startWorkoutWith(tracker, exerciseName);
  for (const set of loggedSets) await tracker.logSet(entry.id, set, weightUnit);
  await tracker.finishWorkout(workout.id);
  return workout;
}

export function weightsAndReps(loggedSets: { weight: number | null; reps: number }[]) {
  return loggedSets.map(set => [set.weight, set.reps]);
}

// A Rotation of new Categories with these names, in order.
export async function createRotationWith(tracker: Tracker, name: string, categoryNames: string[]) {
  const rotation = await tracker.createRotation(name);
  const categories = [];
  const entries = [];
  for (const categoryName of categoryNames) {
    const category = await tracker.createCategory(categoryName);
    categories.push(category);
    entries.push(await tracker.addCategoryToRotation(rotation.id, { id: category.id }));
  }
  return { rotation, categories, entries };
}

// Starts a Workout in the Category, logs a Set of Bench Press and finishes it.
export async function doCategoryWorkout(tracker: Tracker, categoryId: string, start?: NewWorkout) {
  const workout = await tracker.startWorkout({ ...start, categoryId });
  const bench = await findExerciseByName(tracker, 'Bench Press');
  const entry = await tracker.addExerciseToWorkout(workout.id, bench.id);
  await tracker.logSet(entry.id, { weight: 60, reps: 10 }, 'kg');
  await tracker.finishWorkout(workout.id);
  return { workout };
}

// A Food item whose 101 kcal are worked out from its macros (4/4/9).
export const yogurt: FoodItemValues = {
  name: 'Greek yogurt',
  quantity: 170,
  unit: 'g',
  calories: null,
  protein: 17,
  carbs: 6,
  fat: 1,
};

// A Food item with calories typed from its label: 600, though 4/4/9 comes to
// 565.
export const granola: FoodItemValues = {
  name: 'Granola',
  quantity: 1,
  unit: 'cup',
  calories: 600,
  protein: 12,
  carbs: 64,
  fat: 29,
};
