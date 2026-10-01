CREATE TABLE `weigh_ins` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))) NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`deleted_at` integer,
	`local_date` text NOT NULL,
	`weighed_at` integer NOT NULL,
	`weight` real NOT NULL,
	`weight_unit` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weigh_ins_local_date` ON `weigh_ins` (`local_date`);