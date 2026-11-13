// The Exercise library: the built-in Exercises and the lifter's own.

import { and, eq, sql } from 'drizzle-orm';

import { notDeleted } from './records';
import { exercises, type MuscleGroup, type TrackingType } from './schema';
import type { TrackerDatabase } from './tracker';

export type NewExercise = {
  name: string;
  trackingType: TrackingType;
  muscleGroup: MuscleGroup;
};

export type Exercise = NewExercise & {
  id: string;
  isCustom: boolean;
  // The lifter's own rest after a Set of it, in seconds; null uses the default.
  defaultRestSeconds: number | null;
};

// The tracking type is fixed once an Exercise is created.
export type ExerciseChanges = Omit<NewExercise, 'trackingType'>;

export type ExerciseSearch = {
  // Text typed by the lifter: every word must appear somewhere in the name,
  // ignoring case and hyphens.
  query?: string;
  muscleGroup?: MuscleGroup;
};

export const exerciseColumns = {
  id: exercises.id,
  name: exercises.name,
  trackingType: exercises.trackingType,
  muscleGroup: exercises.muscleGroup,
  isCustom: exercises.isCustom,
  defaultRestSeconds: exercises.defaultRestSeconds,
};

// The same, for relational queries.
export const exerciseQueryColumns = {
  id: true,
  name: true,
  trackingType: true,
  muscleGroup: true,
  isCustom: true,
  defaultRestSeconds: true,
} as const;

function requireExerciseName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('An Exercise needs a name');
  return name;
}

export function createExercises({ db, now }: { db: TrackerDatabase; now: () => Date }) {
  // Built-in Exercises are shared across installs and Backup files, and hidden
  // ones keep the name history shows, so only custom Exercises still in the
  // library may change.
  async function changeCustomExercise(id: string, values: Partial<typeof exercises.$inferInsert>) {
    const changed = await db
      .update(exercises)
      .set(values)
      .where(and(eq(exercises.id, id), eq(exercises.isCustom, true), notDeleted(exercises)))
      .returning({ id: exercises.id });
    if (changed.length === 0) {
      throw new Error('Only custom Exercises in the library can be changed');
    }
  }

  const commands = {
    async searchExercises({ query = '', muscleGroup }: ExerciseSearch): Promise<Exercise[]> {
      const words = query.toLowerCase().replace(/-/g, '').split(/\s+/).filter(Boolean);
      const searchableName = sql`replace(lower(${exercises.name}), '-', '')`;
      return db
        .select(exerciseColumns)
        .from(exercises)
        .where(
          and(
            notDeleted(exercises),
            ...words.map(word => sql`instr(${searchableName}, ${word}) > 0`),
            muscleGroup && eq(exercises.muscleGroup, muscleGroup),
          ),
        )
        .orderBy(sql`${exercises.name} COLLATE NOCASE`);
    },

    async createExercise(exercise: NewExercise): Promise<Exercise> {
      const [created] = await db
        .insert(exercises)
        .values({ ...exercise, name: requireExerciseName(exercise.name), isCustom: true })
        .returning(exerciseColumns);
      return created;
    },

    async editExercise(id: string, changes: ExerciseChanges): Promise<void> {
      await changeCustomExercise(id, {
        name: requireExerciseName(changes.name),
        muscleGroup: changes.muscleGroup,
      });
    },

    // Hidden Exercises leave the library but keep their rows for history.
    async hideExercise(id: string): Promise<void> {
      await changeCustomExercise(id, { deletedAt: now() });
    },

    // Any Exercise in the library, built-in ones included: a rest length is the
    // lifter's preference, not part of the Exercise. Null goes back to the default.
    async setExerciseDefaultRest(exerciseId: string, seconds: number | null): Promise<void> {
      if (seconds !== null && (!Number.isInteger(seconds) || seconds < 1)) {
        throw new Error('A rest length is a whole number of seconds, at least 1');
      }
      const changed = await db
        .update(exercises)
        .set({ defaultRestSeconds: seconds })
        .where(and(eq(exercises.id, exerciseId), notDeleted(exercises)))
        .returning({ id: exercises.id });
      if (changed.length === 0) throw new Error('No such Exercise in the library');
    },

    async getExercise(id: string): Promise<Exercise | undefined> {
      const [exercise] = await db
        .select(exerciseColumns)
        .from(exercises)
        .where(eq(exercises.id, id));
      return exercise;
    },
  };

  return { commands };
}
