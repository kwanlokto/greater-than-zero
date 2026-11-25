# Older Backup files are imported through the real migrations

A Backup file from an older version of Notch is brought up to date by the migrations the phone itself ran when it updated. Its rows go into a scratch database at the file's own schema version, the migrations since then run over them, and the result replaces the phone's data. Until now, every migration that changed rows already there was written a second time, as a `formatUpgrades` step over the file's raw rows. Spec #40 alone added three. To agree with SQL, those copies had to imitate SQLite: `lower()` changing A to Z only, rowid order settling ties, and the export time standing in for the moment the migration ran. Only a test said that they did. One copy of each change, in SQL, can't drift.

## Considered Options

- **Keep the copies, and test each against its migration.** Rejected: every later migration that changes rows would still need its copy and its test, and a copy only agrees for the data its test holds.
- **Replay in the import screen instead of the tracker core.** Rejected: the replay would leave the core and the tests that go through it.

## Consequences

- Importing needs somewhere to replay. `createTracker` takes `openScratchDatabase`: the app opens an in-memory expo-sqlite database on a connection of its own, and tests use better-sqlite3. For Backup import, this overrides spec #40's "No new seams" and its rule that a migration changing data bumps the format version.
- `backupFormatVersion` stays at 5 and changes only with the document's own layout. Files of versions 1 to 5 import alike.
- A file must hold exactly the tables and columns of the schema version it claims. One that leaves out a table its version had is refused, rather than having that table emptied.
- Before the lifter confirms an import, only the file's header is checked. Its tables are checked as the import runs, and a failure leaves the phone's data as it was.
