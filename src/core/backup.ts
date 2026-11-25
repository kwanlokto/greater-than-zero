import { getTableColumns, getTableName, is, sql } from 'drizzle-orm';
import { SQLiteTable, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';
import type { TrackerDatabase } from './tracker';

// The Backup file: all the lifter's data as one JSON document, to export and
// import. A file from an older version of the app is brought up to date by the
// migrations the phone itself ran when it updated: its rows go into a scratch
// database at the file's own schema version, the migrations since then run
// over them, and what comes out replaces the phone's data. So a migration that
// changes rows already there needs nothing more for Backups. See
// docs/adr/0002-older-backups-through-migrations.md.

// The layout of the document itself, bumped by hand only when that changes.
// Versions 1 to 5 share one layout and differ only in their rows, which the
// migrations bring up to date. An app refuses files from a newer version. The
// tables' shape is versioned apart, by schemaVersion.
export const backupFormatVersion = 5;

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

// A database apart from the phone's own, to bring an older Backup file's rows
// up to date in: empty but for what its first migrations put there, and set
// up as the phone's database is.
export type ScratchDatabase = {
  db: TrackerDatabase;
  // Runs every migration it hasn't had, as the phone's database has had them.
  bringUpToDate(): Promise<void>;
  close(): void;
};

// Opens a scratch database with the first `schemaVersion` migrations applied.
// The app opens its scratch databases in memory (src/database.ts), and tests
// open theirs with better-sqlite3.
export type OpenScratchDatabase = (schemaVersion: number) => Promise<ScratchDatabase>;

// Every table in the schema, found rather than listed, so one added later is
// backed up without anyone having to remember it.
const schemaExports: unknown[] = Object.values(schema);
const backedUpTables = schemaExports.filter((value): value is SQLiteTable =>
  is(value, SQLiteTable),
);
const backedUpTableNames = backedUpTables.map(table => getTableName(table));

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

// What a Backup file says about itself, checked before its tables are.
type BackupHeader = Omit<BackupFile, 'tables'> & { tables: Record<string, unknown> };

// The header of the Backup file in `contents`, for a database that's had
// `schemaVersion` migrations: that it's a Backup file, from this version of
// the app or an older one, and when it was exported. Throws, saying why, for a
// file from a newer app, or anything that isn't a Backup file. Its tables are
// checked only as they're imported.
function readHeader(contents: string, schemaVersion: number): BackupHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw damaged("it isn't JSON");
  }
  if (!isRecord(parsed)) throw damaged("it isn't a JSON object");
  // Before anything else, as another format may lay the rest out differently.
  const { formatVersion } = parsed;
  if (!isVersion(formatVersion)) throw damaged('it has no format version');
  if (formatVersion > backupFormatVersion) throw fromNewerApp();
  const { schemaVersion: fileSchemaVersion, appVersion, exportedAt, tables } = parsed;
  if (!isVersion(fileSchemaVersion)) throw damaged('it has no schema version');
  if (fileSchemaVersion > schemaVersion) throw fromNewerApp();
  if (
    typeof appVersion !== 'string' ||
    typeof exportedAt !== 'string' ||
    Number.isNaN(Date.parse(exportedAt))
  ) {
    throw damaged("it doesn't say where it's from");
  }
  if (!isRecord(tables)) throw damaged('it has no tables');
  return { formatVersion, schemaVersion: fileSchemaVersion, appVersion, exportedAt, tables };
}

// A column as a database declares it.
type StoredColumn = { name: string; type: string; notNull: boolean };

// Every table in a database, with its columns, read from the database itself:
// a scratch database at an older schema version has tables and columns that
// today's schema doesn't.
function tablesIn(db: TrackerDatabase): Map<string, StoredColumn[]> {
  const tables = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
  );
  return new Map(
    tables.map(({ name }) => [
      name,
      db
        .all<{ name: string; type: string; notnull: number }>(
          sql`SELECT name, type, "notnull" FROM pragma_table_info(${name})`,
        )
        .map(column => ({
          name: column.name,
          type: column.type.toLowerCase(),
          notNull: column.notnull === 1,
        })),
    ]),
  );
}

// Throws unless `tables` holds exactly the tables and columns of `stored`, the
// database at the file's own schema version, with every row whole and each
// value one its column can take as stored. Checked before any of it reaches
// SQLite, which would quietly turn "60" into 60.
function checkRows(tables: Record<string, unknown>, stored: Map<string, StoredColumn[]>) {
  for (const [name, columns] of stored) {
    const rows = tables[name];
    if (!Array.isArray(rows)) throw damaged(`its ${name} table isn't a list of rows`);
    for (const row of rows) {
      if (!isRecord(row)) throw damaged(`a row of its ${name} table isn't a row`);
      for (const key of Object.keys(row)) {
        if (!columns.some(column => column.name === key)) {
          throw damaged(`its ${name} table has no such column as ${key}`);
        }
      }
      for (const column of columns) {
        if (!storable(column, row[column.name])) {
          throw damaged(
            `its ${name} table has ${JSON.stringify(row[column.name])} in ${column.name}`,
          );
        }
      }
    }
  }
  const unknown = Object.keys(tables).find(name => !stored.has(name));
  if (unknown) throw damaged(`the app has no such table as ${unknown}`);
}

// Whether a column can take `value` as stored: text in a text column, a number
// in a column of numbers. Empty only where the column allows it.
function storable(column: StoredColumn, value: unknown): boolean {
  if (value === null || value === undefined) return value === null && !column.notNull;
  if (column.type === 'text') return typeof value === 'string';
  if (column.type === 'integer' || column.type === 'real') return typeof value === 'number';
  return false;
}

// Throws unless every value in `tables`, rows of today's schema, is one its
// column can hold, and there's the one Settings row the app needs.
function checkTables(tables: BackupFile['tables']) {
  for (const table of backedUpTables) {
    const name = getTableName(table);
    const columns = Object.values(getTableColumns(table));
    for (const row of tables[name]) {
      for (const column of columns) {
        if (!fits(column, row[column.name])) {
          throw damaged(
            `its ${name} table has ${JSON.stringify(row[column.name])} in ${column.name}`,
          );
        }
      }
    }
  }
  if (tables.settings.length !== 1) throw damaged('it needs one settings row');
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
    'That backup is from a newer version of Notch. Update the app, then import it again.',
  );
}

function damaged(why: string): Error {
  return new Error(`That file isn't a Notch backup, or it's damaged: ${why}.`);
}

// Replaces every row of the tables named with those in `tables`, as part of a
// larger transaction. Foreign keys are checked once all the rows are in, so
// tables can be emptied and filled in any order. Rows go in in the order
// they're listed, which is the order readTables wrote them, their rowid order:
// recent foods rely on that (getSavedFoodsByRecentUse).
export function writeTables(
  tx: TrackerDatabase,
  tableNames: string[],
  tables: Record<string, unknown>,
) {
  tx.run(sql`PRAGMA defer_foreign_keys = ON`);
  for (const name of tableNames) tx.run(sql`DELETE FROM ${sql.identifier(name)}`);
  for (const name of tableNames) {
    for (const row of tables[name] as Record<string, unknown>[]) {
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
        tx.run(sql`INSERT INTO ${sql.identifier(name)} (${names}) VALUES (${values})`);
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

// What the lifter is told about a Backup file, to confirm importing it.
export type BackupSummary = {
  exportedAt: Date;
};

type Dependencies = {
  db: TrackerDatabase;
  now: () => Date;
  // Without one, importing refuses: there's nowhere to bring a file up to date.
  openScratchDatabase?: OpenScratchDatabase;
};

export function createBackup({ db, now, openScratchDatabase }: Dependencies) {
  // A Backup file's rows brought up to date: put into a scratch database at
  // the file's own schema version, checked against that version's tables, and
  // run through every migration since. A file from today's version takes the
  // same road, with no migrations left to run. The phone's own data isn't
  // touched.
  async function upToDateRows(backup: BackupHeader): Promise<BackupFile['tables']> {
    if (!openScratchDatabase) {
      throw new Error("This tracker can't import Backup files: it has no scratch database");
    }
    const scratch = await openScratchDatabase(backup.schemaVersion);
    try {
      const stored = tablesIn(scratch.db);
      checkRows(backup.tables, stored);
      scratch.db.transaction(tx => writeTables(tx, [...stored.keys()], backup.tables));
      try {
        await scratch.bringUpToDate();
      } catch {
        throw damaged("it couldn't be brought up to date");
      }
      return readTables(scratch.db);
    } finally {
      scratch.close();
    }
  }

  const commands = {
    // The Backup file's contents, as JSON: all the lifter's data, recording
    // the version of the app exporting it.
    async exportBackup(appVersion: string): Promise<string> {
      // Read together, so it's the data as it was at one moment.
      return db.transaction(tx => {
        const backup: BackupFile = {
          formatVersion: backupFormatVersion,
          schemaVersion: schemaVersionOf(tx),
          appVersion,
          exportedAt: now().toISOString(),
          tables: readTables(tx),
        };
        return JSON.stringify(backup);
      });
    },

    // Checks a Backup file before importing it, as far as its header: throws to
    // say why it can't be imported, and says when it was exported. Only
    // importing checks its tables.
    async checkBackup(contents: string): Promise<BackupSummary> {
      const { exportedAt } = readHeader(contents, schemaVersionOf(db));
      return { exportedAt: new Date(exportedAt) };
    },

    // Replaces all the lifter's data with a Backup file's, brought up to date
    // first. The phone's data changes only at the end, all together, so a
    // failure anywhere leaves what was there untouched.
    async importBackup(contents: string): Promise<void> {
      const tables = await upToDateRows(readHeader(contents, schemaVersionOf(db)));
      checkTables(tables);
      db.transaction(tx => writeTables(tx, backedUpTableNames, tables));
    },
  };

  return { commands };
}
