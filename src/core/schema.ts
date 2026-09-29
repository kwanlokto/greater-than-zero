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
  // The rest after a Set, for Exercises without their own.
  defaultRestSeconds: integer('default_rest_seconds').notNull().default(120),
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
// across installs and Backup files. Later library migrations must UPDATE those
// rows, never delete and re-insert them, or the lifter's rest lengths are lost.
export const exercises = sqliteTable('exercises', {
  ...rowColumns,
  name: text('name').notNull(),
  trackingType: text('tracking_type', { enum: trackingTypes }).notNull(),
  muscleGroup: text('muscle_group', { enum: muscleGroups }).notNull(),
  // Defaults to built-in, so rows inserted by library migrations are protected.
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  // The lifter's own rest after a Set of this Exercise; empty uses Settings'.
  defaultRestSeconds: integer('default_rest_seconds'),
});

// A Workout to repeat: a name and an ordered list of Exercises with Targets.
export const templates = sqliteTable('templates', {
  ...rowColumns,
  name: text('name').notNull(),
});

// An Exercise in a Template, with its Target: sets × rep range @ weight.
export const templateExercises = sqliteTable('template_exercises', {
  ...rowColumns,
  templateId: text('template_id')
    .notNull()
    .references(() => templates.id),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: integer('position').notNull(),
  targetSets: integer('target_sets').notNull(),
  minReps: integer('min_reps').notNull(),
  maxReps: integer('max_reps').notNull(),
  // Exactly as entered, in the unit it was entered in, like a Set's weight.
  // For a bodyweight Exercise it's the added weight, empty for none.
  targetWeight: real('target_weight'),
  targetWeightUnit: text('target_weight_unit', { enum: weightUnits }).notNull(),
});

// Templates done in turn, e.g. Push → Pull → Legs, deciding which is next up
// whatever the weekday.
export const rotations = sqliteTable('rotations', {
  ...rowColumns,
  name: text('name').notNull(),
  // The one next up comes from. At most one Rotation is active.
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
});

// A Template in a Rotation, at its place in the turn.
export const rotationEntries = sqliteTable('rotation_entries', {
  ...rowColumns,
  rotationId: text('rotation_id')
    .notNull()
    .references(() => rotations.id),
  templateId: text('template_id')
    .notNull()
    .references(() => templates.id),
  position: integer('position').notNull(),
});

export const workouts = sqliteTable('workouts', {
  ...rowColumns,
  // The phone's local calendar date the Workout counts toward, as YYYY-MM-DD:
  // the date it started on, or the earlier one it was backfilled onto. All
  // grouping by day uses it.
  localDate: text('local_date').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  // Added afterwards onto an earlier date, so its times are only when it was
  // entered. Stored rather than worked out from the dates, which would change
  // with the phone's time zone.
  isBackfilled: integer('is_backfilled', { mode: 'boolean' }).notNull().default(false),
  // Empty while the Workout is in progress.
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  // When the current rest ends. Set by logging a Set; the timer counts down to it.
  restEndsAt: integer('rest_ends_at', { mode: 'timestamp_ms' }),
  // The Template it was started from; empty when started empty.
  templateId: text('template_id').references(() => templates.id),
  // The Rotation it counted toward: the active one, when it was started from
  // one of its Templates. Empty otherwise.
  rotationId: text('rotation_id').references(() => rotations.id),
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
  // Free text, e.g. cues, pain or machine settings.
  notes: text('notes').notNull().default(''),
  // The Template exercise it was copied from when the Workout started from a
  // Template; empty for one added during the Workout or swapped in.
  templateExerciseId: text('template_exercise_id').references(() => templateExercises.id),
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

// A Set a Workout started from a Template plans to do, pre-filled from the
// Target. Confirming one logs a Set and deletes it; finishing the Workout
// deletes the rest, so only logged Sets are ever recorded.
export const plannedSets = sqliteTable('planned_sets', {
  ...rowColumns,
  exerciseEntryId: text('exercise_entry_id')
    .notNull()
    .references(() => exerciseEntries.id),
  position: integer('position').notNull(),
  // The Target's weight, in its unit; empty for plain bodyweight.
  weight: real('weight'),
  weightUnit: text('weight_unit', { enum: weightUnits }).notNull(),
  reps: integer('reps').notNull(),
});

export const templatesRelations = relations(templates, ({ many }) => ({
  exercises: many(templateExercises),
}));

export const templateExercisesRelations = relations(templateExercises, ({ one }) => ({
  template: one(templates, { fields: [templateExercises.templateId], references: [templates.id] }),
  exercise: one(exercises, {
    fields: [templateExercises.exerciseId],
    references: [exercises.id],
  }),
}));

export const rotationsRelations = relations(rotations, ({ many }) => ({
  entries: many(rotationEntries),
}));

export const rotationEntriesRelations = relations(rotationEntries, ({ one }) => ({
  rotation: one(rotations, { fields: [rotationEntries.rotationId], references: [rotations.id] }),
  template: one(templates, { fields: [rotationEntries.templateId], references: [templates.id] }),
}));

export const workoutsRelations = relations(workouts, ({ many }) => ({
  entries: many(exerciseEntries),
}));

export const exerciseEntriesRelations = relations(exerciseEntries, ({ one, many }) => ({
  workout: one(workouts, { fields: [exerciseEntries.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [exerciseEntries.exerciseId], references: [exercises.id] }),
  sets: many(sets),
  plannedSets: many(plannedSets),
}));

export const plannedSetsRelations = relations(plannedSets, ({ one }) => ({
  exerciseEntry: one(exerciseEntries, {
    fields: [plannedSets.exerciseEntryId],
    references: [exerciseEntries.id],
  }),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  exerciseEntry: one(exerciseEntries, {
    fields: [sets.exerciseEntryId],
    references: [exerciseEntries.id],
  }),
}));
