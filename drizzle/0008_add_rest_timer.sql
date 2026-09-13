ALTER TABLE `exercises` ADD `default_rest_seconds` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_rest_seconds` integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `rest_ends_at` integer;