// Reading Workouts: each with its entries, their Exercises, and the Sets
// logged and still planned, as every area that shows or works from a Workout
// sees it. Workouts, Template workouts and History's day all read here.

import { and, asc, eq, type SQL } from 'drizzle-orm';

import { exerciseQueryColumns } from './exercises';
import { notDeleted } from './records';
import { exerciseEntries, plannedSets, sets, workouts, type WeightUnit } from './schema';
import { workoutOrder } from './session-history';
import type { TrackerDatabase } from './tracker';
import { withDisplayWeight } from './weights';
import type { Workout } from './workouts';

export type WorkoutReads = ReturnType<typeof createWorkoutReads>;

export function createWorkoutReads(
  db: TrackerDatabase,
  { getDisplayUnit }: { getDisplayUnit: () => Promise<WeightUnit> },
) {
  // The Workouts matching `where`, in the order Workouts go in. Deleted ones,
  // and their removed entries and deleted Sets, are left out.
  async function findWorkouts(where: SQL | undefined): Promise<Workout[]> {
    const found = await db.query.workouts.findMany({
      where: and(where, notDeleted(workouts)),
      orderBy: workoutOrder,
      columns: {
        id: true,
        localDate: true,
        startedAt: true,
        finishedAt: true,
        isBackfilled: true,
        restEndsAt: true,
        templateId: true,
        rotationId: true,
      },
      with: {
        entries: {
          where: notDeleted(exerciseEntries),
          orderBy: asc(exerciseEntries.position),
          columns: { id: true, notes: true },
          with: {
            exercise: { columns: exerciseQueryColumns },
            sets: {
              where: notDeleted(sets),
              orderBy: asc(sets.position),
              columns: {
                id: true,
                weight: true,
                weightUnit: true,
                reps: true,
                isWarmUp: true,
                loggedAt: true,
              },
            },
            plannedSets: {
              where: notDeleted(plannedSets),
              orderBy: asc(plannedSets.position),
              columns: { id: true, weight: true, weightUnit: true, reps: true },
            },
          },
        },
      },
    });
    const displayUnit = await getDisplayUnit();
    return found.map(workout => ({
      ...workout,
      entries: workout.entries.map(entry => ({
        ...entry,
        sets: entry.sets.map(set => withDisplayWeight(set, displayUnit)),
      })),
    }));
  }

  // Undefined once it's deleted.
  async function findWorkout(id: string): Promise<Workout | undefined> {
    const [workout] = await findWorkouts(eq(workouts.id, id));
    return workout;
  }

  return { findWorkouts, findWorkout };
}
