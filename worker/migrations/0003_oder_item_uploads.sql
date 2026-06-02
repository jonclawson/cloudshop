CREATE TABLE `order_item_uploads` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`order_item_id` text NOT NULL,
	`user_upload_id` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `order_item_uploads_order_item_id_index` ON `order_item_uploads` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `order_item_uploads_user_upload_id_index` ON `order_item_uploads` (`user_upload_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_item_uploads_order_item_id_user_upload_id_unique` ON `order_item_uploads` (`order_item_id`,`user_upload_id`);--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `user_upload_id`;