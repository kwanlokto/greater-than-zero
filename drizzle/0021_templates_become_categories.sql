-- Templates become Categories, and Template exercises with their Targets go
-- (#40). An older Backup file goes through this same migration as it's
-- imported.
--
-- A Workout from a deleted Template is in no Category.
UPDATE `workouts` SET `template_id` = NULL
WHERE `template_id` IN (SELECT `id` FROM `templates` WHERE `deleted_at` IS NOT NULL);
--> statement-breakpoint
-- Templates with the same name become one Category: the earliest made takes
-- the others' Workouts and their places in Rotations.
UPDATE `workouts` SET `template_id` = (
  SELECT `first`.`id` FROM `templates` AS `first`, `templates` AS `own`
  WHERE `own`.`id` = `workouts`.`template_id` AND `first`.`deleted_at` IS NULL
    AND lower(trim(`first`.`name`)) = lower(trim(`own`.`name`))
  ORDER BY `first`.`created_at`, `first`.`rowid` LIMIT 1
)
WHERE `template_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `rotation_entries` SET `template_id` = (
  SELECT `first`.`id` FROM `templates` AS `first`, `templates` AS `own`
  WHERE `own`.`id` = `rotation_entries`.`template_id` AND `first`.`deleted_at` IS NULL
    AND lower(trim(`first`.`name`)) = lower(trim(`own`.`name`))
  ORDER BY `first`.`created_at`, `first`.`rowid` LIMIT 1
)
WHERE `template_id` IN (SELECT `id` FROM `templates` WHERE `deleted_at` IS NULL);
--> statement-breakpoint
-- A Rotation that held more than one of them keeps the first.
UPDATE `rotation_entries` SET `deleted_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER)
WHERE `id` IN (
  SELECT `later`.`id` FROM `rotation_entries` AS `later`, `rotation_entries` AS `first`
  WHERE `later`.`deleted_at` IS NULL AND `first`.`deleted_at` IS NULL
    AND `first`.`rotation_id` = `later`.`rotation_id`
    AND `first`.`template_id` = `later`.`template_id`
    AND (`first`.`position` < `later`.`position`
      OR (`first`.`position` = `later`.`position` AND `first`.`rowid` < `later`.`rowid`))
);
--> statement-breakpoint
UPDATE `templates` SET `deleted_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER)
WHERE `id` IN (
  SELECT `later`.`id` FROM `templates` AS `later`, `templates` AS `first`
  WHERE `later`.`deleted_at` IS NULL AND `first`.`deleted_at` IS NULL
    AND lower(trim(`first`.`name`)) = lower(trim(`later`.`name`))
    AND (`first`.`created_at` < `later`.`created_at`
      OR (`first`.`created_at` = `later`.`created_at` AND `first`.`rowid` < `later`.`rowid`))
);
--> statement-breakpoint
ALTER TABLE `exercise_entries` DROP COLUMN `template_exercise_id`;
--> statement-breakpoint
DROP TABLE `template_exercises`;
--> statement-breakpoint
ALTER TABLE `templates` RENAME TO `categories`;
--> statement-breakpoint
ALTER TABLE `workouts` RENAME COLUMN `template_id` TO `category_id`;
--> statement-breakpoint
ALTER TABLE `rotation_entries` RENAME COLUMN `template_id` TO `category_id`;
