PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`stripe_payment_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_price` real NOT NULL,
	`printful_order_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "user_id", "stripe_payment_id", "status", "total_price", "printful_order_id", "created_at", "updated_at") SELECT "id", "user_id", "stripe_payment_id", "status", "total_price", "printful_order_id", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;