CREATE TABLE `saved_foods` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))) NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`serving_amount` real NOT NULL,
	`serving_unit` text NOT NULL,
	`calories` real,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL
);
--> statement-breakpoint
ALTER TABLE `food_items` ADD `saved_food_id` text REFERENCES saved_foods(id);