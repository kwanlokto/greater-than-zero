CREATE TABLE `planned_sets` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))) NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`deleted_at` integer,
	`exercise_entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`weight` real,
	`weight_unit` text NOT NULL,
	`reps` integer NOT NULL,
	FOREIGN KEY (`exercise_entry_id`) REFERENCES `exercise_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `workouts` ADD `template_id` text REFERENCES templates(id);