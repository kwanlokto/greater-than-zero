import { relations, sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const nowMs = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

// Every table spreads these in. IDs and timestamps default inside SQLite, so rows
// inserted by hand-written SQL migrations get them too. Drizzle bumps updated_at
// on update; a hand-written SQL UPDATE must set it itself.
const rowColumns = {
  // Random (version 4) UUID.
  id: text('id')
    .primaryKey()
    .default(
      sql`(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))`,
    ),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(nowMs)
    .$onUpdate(() => new Date()),
  // Soft delete: set instead of removing the row.
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export const weightUnits = ['lb', 'kg'] as const;
export type WeightUnit = (typeof weightUnits)[number];

// A single row, inserted by a migration.
export const settings = sqliteTable('settings', {
  ...rowColumns,
  displayUnit: text('display_unit', { enum: weightUnits }).notNull().default('kg'),
});

// How an Exercise's Sets are recorded. Stored as plain text with no CHECK
// constraint, so a later type (e.g. timed, cardio) is a new value here plus new
// nullable Set columns, with no change to existing Sets.
export const trackingTypes = ['weighted', 'bodyweight'] as const;
export type TrackingType = (typeof trackingTypes)[number];

export const muscleGroups = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const;
export type MuscleGroup = (typeof muscleGroups)[number];

// Built-in Exercises are inserted by migrations with fixed IDs, so they match
// across installs and Backup files.
export const exercises = sqliteTable('exercises', {
  ...rowColumns,
  name: text('name').notNull(),
  trackingType: text('tracking_type', { enum: trackingTypes }).notNull(),
  muscleGroup: text('muscle_group', { enum: muscleGroups }).notNull(),
  // Defaults to built-in, so rows inserted by library migrations are protected.
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
});

export const workouts = sqliteTable('workouts', {
  ...rowColumns,
  // The phone's local calendar date when the Workout started, as YYYY-MM-DD.
  // All grouping by day uses it.
  localDate: text('local_date').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  // Empty while the Workout is in progress.
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
});

// An Exercise within a Workout.
export const exerciseEntries = sqliteTable('exercise_entries', {
  ...rowColumns,
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: integer('position').notNull(),
});

export const sets = sqliteTable('sets', {
  ...rowColumns,
  exerciseEntryId: text('exercise_entry_id')
    .notNull()
    .references(() => exerciseEntries.id),
  position: integer('position').notNull(),
  // Exactly as entered, in the unit it was entered in; never converted.
  // Empty for a bodyweight Set with no added weight.
  weight: real('weight'),
  weightUnit: text('weight_unit', { enum: weightUnits }).notNull(),
  reps: integer('reps').notNull(),
  // Warm-ups are left out of charts, Targets and "last time".
  isWarmUp: integer('is_warm_up', { mode: 'boolean' }).notNull().default(false),
  loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
});

export const workoutsRelations = relations(workouts, ({ many }) => ({
  entries: many(exerciseEntries),
}));

export const exerciseEntriesRelations = relations(exerciseEntries, ({ one, many }) => ({
  workout: one(workouts, { fields: [exerciseEntries.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [exerciseEntries.exerciseId], references: [exercises.id] }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  exerciseEntry: one(exerciseEntries, {
    fields: [sets.exerciseEntryId],
    references: [exerciseEntries.id],
  }),
}));
