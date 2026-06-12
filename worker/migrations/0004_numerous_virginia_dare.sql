CREATE TABLE `addresses` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text NOT NULL,
	`name` text,
	`line1` text,
	`line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `addresses_user_id_index` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `order_addresses` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`order_id` text NOT NULL,
	`address_id` text NOT NULL,
	`address_type` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `order_addresses_order_id_index` ON `order_addresses` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_addresses_address_id_index` ON `order_addresses` (`address_id`);