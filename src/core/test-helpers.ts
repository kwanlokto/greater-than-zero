import type { Tracker } from './tracker';

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
export async function startWorkoutWithEach(tracker: Tracker, exerciseNames: string[]) {
  const workout = await tracker.startWorkout();
  const entries = [];
  for (const name of exerciseNames) {
    const exercise = await findExerciseByName(tracker, name);
    entries.push(await tracker.addExerciseToWorkout(workout.id, exercise.id));
  }
  return { workout, entries };
}

// Starts a Workout with one Exercise in it.
export async function startWorkoutWith(tracker: Tracker, exerciseName: string) {
  const { workout, entries } = await startWorkoutWithEach(tracker, [exerciseName]);
  return { workout, entry: entries[0] };
}

// The Sets of a Workout's first Exercise.
export async function setsOf(tracker: Tracker, workoutId: string) {
  const [entry] = (await tracker.getWorkout(workoutId))?.entries ?? [];
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
