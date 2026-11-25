-- Next up is read from History, so a Workout no longer records the Rotation it
-- counted toward (#40). backupFormatVersion 5 takes it out of an older Backup
-- file. Written by hand: drizzle-kit rebuilds the table to drop a column with
-- a reference, which can't be done inside the transaction migrations run in.
ALTER TABLE `workouts` DROP COLUMN `rotation_id`;
