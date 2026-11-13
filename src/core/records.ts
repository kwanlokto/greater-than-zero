// Records are soft-deleted: a deleted row stays, with deletedAt set, for
// history and Backup files. This decides in one place what's still there,
// what's deleted along with what, and where rows go in their lists.

import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  exerciseEntries,
  foodItems,
  meals,
  plannedSets,
  rotationEntries,
  rotations,
  sets,
  templateExercises,
  templates,
  workouts,
} from './schema';
import type { TrackerDatabase } from './tracker';

type Deletable = { deletedAt: SQLiteColumn };
type Record = SQLiteTable & Deletable & { id: SQLiteColumn };
type Listed = Record & { position: SQLiteColumn };

// A row that hasn't been deleted.
export function notDeleted(table: Deletable): SQL {
  return isNull(table.deletedAt);
}

// The row with this ID, unless it's been deleted, on its own or with what it
// belongs to (see deletedWith).
export function stillThere(table: Record, id: string): SQL {
  return and(eq(table.id, id), notDeleted(table)) as SQL;
}

// What's deleted along with a row: its children, by the column that names it.
// A deleted Workout takes its Exercise entries, and an Exercise entry its Sets
// and planned Sets; a Template its Exercises and its places in Rotations; a
// Rotation its places; a Meal its Food items.
const deletedWith = new Map<SQLiteTable, { table: Record; parent: SQLiteColumn }[]>([
  [workouts, [{ table: exerciseEntries, parent: exerciseEntries.workoutId }]],
  [
    exerciseEntries,
    [
      { table: sets, parent: sets.exerciseEntryId },
      { table: plannedSets, parent: plannedSets.exerciseEntryId },
    ],
  ],
  [
    templates,
    [
      { table: templateExercises, parent: templateExercises.templateId },
      { table: rotationEntries, parent: rotationEntries.templateId },
    ],
  ],
  [rotations, [{ table: rotationEntries, parent: rotationEntries.rotationId }]],
  [meals, [{ table: foodItems, parent: foodItems.mealId }]],
]);

// Soft-deletes the rows of `table` matching `where` that are still there, and
// everything deleted along with them, all at `deletedAt`, as part of a larger
// transaction. `also` sets more columns on the rows themselves. Returns their
// IDs: none when nothing matched.
export function softDelete(
  tx: TrackerDatabase,
  table: Record,
  where: SQL | undefined,
  deletedAt: Date,
  also: object = {},
): string[] {
  const deleted = tx
    .update(table)
    .set({ ...also, deletedAt } as never)
    .where(and(where, notDeleted(table)))
    .returning({ id: table.id })
    .all() as { id: string }[];
  const ids = deleted.map(row => row.id);
  if (ids.length > 0) {
    for (const child of deletedWith.get(table) ?? []) {
      softDelete(tx, child.table, inArray(child.parent, ids), deletedAt);
    }
  }
  return ids;
}

// The position after the last one used among the rows matching `where`, so a
// new row goes at the end. Deleted rows keep theirs, so positions aren't
// reused. Synchronous, so it can run inside a transaction.
export function positionAfterLast(
  tx: TrackerDatabase,
  table: SQLiteTable,
  position: SQLiteColumn,
  where: SQL,
): number {
  const [{ next }] = tx
    .select({ next: sql<number>`coalesce(max(${position}), -1) + 1` })
    .from(table)
    .where(where)
    .all();
  return next;
}

// Puts the row `id` at `toIndex`, counting from 0, among the rows still there
// with the same `parent`, and shifts the ones in between along by one. Says
// when there's no such row, or no such place.
export function moveInList(
  tx: TrackerDatabase,
  table: Listed,
  parent: SQLiteColumn,
  id: string,
  toIndex: number,
): 'moved' | 'no such row' | 'no such place' {
  const moving = tx.select({ parent }).from(table).where(stillThere(table, id)).get() as
    { parent: string } | undefined;
  if (!moving) return 'no such row';
  const order = (
    tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(parent, moving.parent), notDeleted(table)))
      .orderBy(asc(table.position))
      .all() as { id: string }[]
  ).map(row => row.id);
  const moved = movedTo(order, id, toIndex);
  if (!moved) return 'no such place';
  moved.forEach((rowId, position) => {
    tx.update(table)
      .set({ position } as never)
      .where(eq(table.id, rowId))
      .run();
  });
  return 'moved';
}

// The IDs in `order` with `id` moved to `toIndex`, counting from 0, and the
// ones in between shifted along by one. Undefined when there's no such place.
function movedTo(order: string[], id: string, toIndex: number): string[] | undefined {
  const others = order.filter(other => other !== id);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > others.length) return undefined;
  others.splice(toIndex, 0, id);
  return others;
}
