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
