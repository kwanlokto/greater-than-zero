import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const nowMs = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

// Every table spreads these in. IDs and timestamps default inside SQLite, so the
// same rules apply in the app, in Node tests and in hand-written SQL migrations.
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
