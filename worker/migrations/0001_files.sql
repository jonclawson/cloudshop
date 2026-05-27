CREATE TABLE `files` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`parent` text NOT NULL,
	`parent_id` text NOT NULL,
	`url` text NOT NULL,
	`filename` text NOT NULL,
	`meta` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `files_parent_parent_id_index` ON `files` (`parent`,`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_parent_parent_id_url_unique` ON `files` (`parent`,`parent_id`,`url`);