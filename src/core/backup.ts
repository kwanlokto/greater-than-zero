import { getTableName, is, sql } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import type { TrackerDatabase } from './tracker';

// The Backup file: all the lifter's data as one JSON document, to export and
// import.

// Bumped whenever the document changes in a way importing has to handle, so
// an app refuses files from a newer version and upgrades older ones.
export const backupFormatVersion = 1;

export type BackupFile = {
  formatVersion: number;
  // The version of the app that exported it.
  appVersion: string;
  // When it was exported, as an ISO 8601 timestamp.
  exportedAt: string;
  // Every table's rows, soft-deleted ones included, by table name (see
  // readTables).
  tables: Record<string, Record<string, unknown>[]>;
};

// Every table in the schema, found rather than listed, so one added later is
// backed up without anyone having to remember it.
const schemaExports: unknown[] = Object.values(schema);
const backedUpTables = schemaExports.filter((value): value is SQLiteTable =>
  is(value, SQLiteTable),
);

// Every row of every table, in the order they were added, exactly as stored:
// columns by their names in the database, timestamps as milliseconds and flags
// as 0 or 1. Those names change only with a migration, and the values go back
// in unchanged.
export function readTables(db: TrackerDatabase): BackupFile['tables'] {
  return Object.fromEntries(
    backedUpTables.map(table => [
      getTableName(table),
      db.all<Record<string, unknown>>(sql`SELECT * FROM ${table} ORDER BY rowid`),
    ]),
  );
}
