CREATE TABLE `cart_sessions` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text,
	`session_key` text NOT NULL,
	`cart_data` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_sessions_session_key_unique` ON `cart_sessions` (`session_key`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`order_id` text NOT NULL,
	`product_variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_at_purchase` real NOT NULL,
	`user_upload_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text NOT NULL,
	`stripe_payment_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_price` real NOT NULL,
	`printful_order_id` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `product_sync_log` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`synced_at` integer DEFAULT CURRENT_TIMESTAMP,
	`product_count` integer,
	`variant_count` integer,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`product_id` text NOT NULL,
	`size` text,
	`color` text,
	`price_override` real,
	`provider_variant_id` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`description` text,
	`base_price` real NOT NULL,
	`provider` text NOT NULL,
	`provider_product_id` text NOT NULL,
	`provider_sync_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `user_uploads` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`user_id` text NOT NULL,
	`file_key` text NOT NULL,
	`file_url` text NOT NULL,
	`file_size` integer,
	`design_name` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT 'uuid()' NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`admin` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);