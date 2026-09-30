import { getTableColumns, getTableName, is, sql } from 'drizzle-orm';
import { SQLiteTable, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import type { TrackerDatabase } from './tracker';

// The Backup file: all the lifter's data as one JSON document, to export and
// import.

// Bumped by hand when importing an older file needs more than leaving tables
// added since empty and giving columns added since their defaults: when the
// document's own layout changes, or a migration changes rows already there
// (e.g. adding a built-in Exercise). Each bump adds a step to formatUpgrades.
// An app refuses files from a newer version. The tables' shape is versioned
// apart, by schemaVersion.
export const backupFormatVersion = 1;

export type BackupFile = {
  formatVersion: number;
  // How many migrations had shaped the tables it holds, so an app can refuse
  // rows from a newer schema than its own, and knows which of its migrations
  // an older file's rows predate. Every migration counts, so it can't be
  // forgotten when a table or column is added.
  schemaVersion: number;
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

// How many migrations the database has had, from the record Drizzle's
// migrator keeps in both the app and the tests.
export function schemaVersionOf(db: TrackerDatabase): number {
  const [{ count }] = db.all<{ count: number }>(
    sql`SELECT count(*) AS count FROM __drizzle_migrations`,
  );
  return count;
}

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

// Brings a file in an older format up to date, one version at a time:
// formatUpgrades[n] turns a version n file into a version n + 1 one. Empty
// until the format first changes, when bumping backupFormatVersion to 2 means
// adding formatUpgrades[1].
const formatUpgrades: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> =
  {};

// The Backup file in `contents`, checked and in the current format, for a
// database that's had `schemaVersion` migrations. Throws, saying why, for one
// from a newer app, or anything that isn't a Backup file the database can take.
export function parseBackup(contents: string, schemaVersion: number): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw damaged("it isn't JSON");
  }
  if (!isRecord(parsed)) throw damaged("it isn't a JSON object");
  // Before anything else, as another format may lay the rest out differently.
  let upgraded = parsed;
  const { formatVersion } = upgraded;
  if (!isVersion(formatVersion)) throw damaged('it has no format version');
  if (formatVersion > backupFormatVersion) throw fromNewerApp();
  for (let version = formatVersion; version < backupFormatVersion; version++) {
    upgraded = { ...formatUpgrades[version](upgraded), formatVersion: version + 1 };
  }
  const { schemaVersion: fileSchemaVersion, appVersion, exportedAt, tables } = upgraded;
  if (!isVersion(fileSchemaVersion)) throw damaged('it has no schema version');
  if (fileSchemaVersion > schemaVersion) throw fromNewerApp();
  if (
    typeof appVersion !== 'string' ||
    typeof exportedAt !== 'string' ||
    Number.isNaN(Date.parse(exportedAt))
  ) {
    throw damaged("it doesn't say where it's from");
  }
  checkTables(tables, fileSchemaVersion === schemaVersion);
  return upgraded as BackupFile;
}

// Throws unless `tables` holds only this database's tables and columns, each
// value one its column can hold, and the one Settings row the app needs. A
// file as new as the database (`complete`) has every table and column; an
// older one may lack those added since, which then start empty or take their
// defaults.
function checkTables(tables: unknown, complete: boolean) {
  if (!isRecord(tables)) throw damaged('it has no tables');
  for (const table of backedUpTables) {
    const name = getTableName(table);
    const rows = tables[name];
    if (rows === undefined && !complete) continue;
    if (!Array.isArray(rows)) throw damaged(`its ${name} table isn't a list of rows`);
    const columns = Object.values(getTableColumns(table));
    for (const row of rows) {
      if (!isRecord(row)) throw damaged(`a row of its ${name} table isn't a row`);
      for (const key of Object.keys(row)) {
        if (!columns.some(column => column.name === key)) {
          throw damaged(`its ${name} table has no such column as ${key}`);
        }
      }
      for (const column of columns) {
        if (!(column.name in row) && !complete) continue;
        if (!fits(column, row[column.name])) {
          throw damaged(
            `its ${name} table has ${JSON.stringify(row[column.name])} in ${column.name}`,
          );
        }
      }
    }
  }
  const known = new Set(backedUpTables.map(table => getTableName(table)));
  const unknown = Object.keys(tables).find(name => !known.has(name));
  if (unknown) throw damaged(`the app has no such table as ${unknown}`);
  const settingsRows = tables.settings;
  if (!Array.isArray(settingsRows) || settingsRows.length !== 1) {
    throw damaged('it needs one settings row');
  }
}

// Whether a column can hold `value` as stored: text for text (one of its
// values, for a list of them), numbers for numbers and timestamps, and 0 or 1
// for flags. Empty only where the column allows it.
function fits(column: SQLiteColumn, value: unknown): boolean {
  if (value === null || value === undefined) return value === null && !column.notNull;
  switch (column.dataType) {
    case 'string':
      return typeof value === 'string' && (!column.enumValues || column.enumValues.includes(value));
    case 'boolean':
      return value === 0 || value === 1;
    case 'number':
    case 'date':
      return typeof value === 'number';
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function fromNewerApp(): Error {
  return new Error(
    'That backup is from a newer version of Greater Than Zero. Update the app, then import it again.',
  );
}

function damaged(why: string): Error {
  return new Error(`That file isn't a Greater Than Zero backup, or it's damaged: ${why}.`);
}

// Replaces every table's rows with the file's, as part of a larger
// transaction. Foreign keys are checked once all the rows are in, so tables
// can be emptied and filled in any order. A table the file doesn't have, from
// before it was added, is left empty. Rows go back in the order readTables
// wrote them, which is their rowid order: recent foods rely on that
// (getSavedFoodsByRecentUse).
export function writeTables(tx: TrackerDatabase, tables: BackupFile['tables']) {
  tx.run(sql`PRAGMA defer_foreign_keys = ON`);
  for (const table of backedUpTables) tx.run(sql`DELETE FROM ${table}`);
  for (const table of backedUpTables) {
    for (const row of tables[getTableName(table)] ?? []) {
      const columns = Object.keys(row);
      const names = sql.join(
        columns.map(column => sql.identifier(column)),
        sql`, `,
      );
      const values = sql.join(
        columns.map(column => sql`${row[column]}`),
        sql`, `,
      );
      try {
        tx.run(sql`INSERT INTO ${table} (${names}) VALUES (${values})`);
      } catch {
        // Two rows with the same ID, or one without a column it needs.
        throw damaged('some of its records repeat or leave out details');
      }
    }
  }
  if (tx.all(sql`PRAGMA foreign_key_check`).length > 0) {
    throw damaged("some of its records point to ones it doesn't have");
  }
}
