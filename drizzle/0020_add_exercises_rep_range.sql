ALTER TABLE `exercises` ADD `min_reps` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `max_reps` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
-- Each Exercise takes its range from the Target changed most recently among
-- those still in a Template. One that never had a Target keeps 8-12.
-- backupFormatVersion 3 makes the same change to an older Backup file.
UPDATE `exercises` SET
  `min_reps` = (
    SELECT `target`.`min_reps` FROM `template_exercises` AS `target`
    WHERE `target`.`exercise_id` = `exercises`.`id` AND `target`.`deleted_at` IS NULL
    ORDER BY `target`.`updated_at` DESC, `target`.`rowid` DESC LIMIT 1
  ),
  `max_reps` = (
    SELECT `target`.`max_reps` FROM `template_exercises` AS `target`
    WHERE `target`.`exercise_id` = `exercises`.`id` AND `target`.`deleted_at` IS NULL
    ORDER BY `target`.`updated_at` DESC, `target`.`rowid` DESC LIMIT 1
  )
WHERE `id` IN (SELECT `exercise_id` FROM `template_exercises` WHERE `deleted_at` IS NULL);
