import type { FoodItemValues, NewWorkout, SetValues, TargetValues, Tracker } from './tracker';

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

// Starts, logs and finishes a Workout with one Exercise.
export async function doWorkout(tracker: Tracker, exerciseName: string, loggedSets: SetValues[]) {
  const { workout, entry } = await startWorkoutWith(tracker, exerciseName);
  for (const set of loggedSets) await tracker.logSet(entry.id, set);
  await tracker.finishWorkout(workout.id);
  return workout;
}

export function weightsAndReps(loggedSets: { weight: number | null; reps: number }[]) {
  return loggedSets.map(set => [set.weight, set.reps]);
}

export const threeByEightToTwelve: TargetValues = {
  sets: 3,
  minReps: 8,
  maxReps: 12,
  weight: 60,
  weightUnit: 'kg',
};

// A Template holding these Exercises, in order, each with the same Target.
export async function createTemplateWith(
  tracker: Tracker,
  name: string,
  exerciseNames: string[],
  target: TargetValues = threeByEightToTwelve,
) {
  const template = await tracker.createTemplate(name);
  const exercises = [];
  for (const exerciseName of exerciseNames) {
    const exercise = await findExerciseByName(tracker, exerciseName);
    exercises.push(await tracker.addExerciseToTemplate(template.id, exercise.id, target));
  }
  return { template, exercises };
}

// Each Exercise in the Template with its Target, as [name, sets, min, max, weight, unit].
export async function targetsOf(tracker: Tracker, templateId: string) {
  const template = await tracker.getTemplate(templateId);
  return template?.exercises.map(({ exercise, target }) => [
    exercise.name,
    target.sets,
    target.minReps,
    target.maxReps,
    target.weight,
    target.weightUnit,
  ]);
}

// A Rotation of new Templates with these names, in order, each holding one
// Exercise with the same Target.
export async function createRotationWith(tracker: Tracker, name: string, templateNames: string[]) {
  const rotation = await tracker.createRotation(name);
  const templates = [];
  const entries = [];
  for (const templateName of templateNames) {
    const { template } = await createTemplateWith(tracker, templateName, ['Bench Press']);
    templates.push(template);
    entries.push(await tracker.addTemplateToRotation(rotation.id, template.id));
  }
  return { rotation, templates, entries };
}

// Starts a Workout from the Template, logs a Set and finishes it.
export async function doTemplateWorkout(tracker: Tracker, templateId: string, start?: NewWorkout) {
  const workout = await tracker.startWorkout({ ...start, templateId });
  const [entry] = await entriesOf(tracker, workout.id);
  await tracker.logSet(entry.id, { weight: 60, reps: 10 });
  return { workout, summary: await tracker.finishWorkout(workout.id) };
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
