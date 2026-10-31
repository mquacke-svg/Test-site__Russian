CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `account_provider_identity` ON `account` (`provider_id`,`account_id`);
CREATE TABLE `cart` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_hash` text,
	`user_id` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `cart_guest_hash_unique` ON `cart` (`guest_hash`);
CREATE UNIQUE INDEX `cart_user_id_unique` ON `cart` (`user_id`);
CREATE TABLE `cart_item` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `cart`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `cart_item_identity` ON `cart_item` (`cart_id`,`product_id`,`variant_id`);
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`emoji` text NOT NULL
);

CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`phone` text,
	`phone_raw` text,
	`hours` text NOT NULL
);

CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`sent_at` integer,
	`last_error` text,
	FOREIGN KEY (`order_id`) REFERENCES `shop_order`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `notification_order_id_unique` ON `notification` (`order_id`);
CREATE TABLE `shop_order` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` text,
	`guest_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`fulfillment` text NOT NULL,
	`address` text,
	`location_id` text,
	`location_label` text,
	`comment` text NOT NULL,
	`subtotal` integer NOT NULL,
	`delivery` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `shop_order_number_unique` ON `shop_order` (`number`);
CREATE UNIQUE INDEX `shop_order_idempotency_key_unique` ON `shop_order` (`idempotency_key`);
CREATE TABLE `order_item` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`variant_label` text,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`image` text,
	FOREIGN KEY (`order_id`) REFERENCES `shop_order`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`price` integer,
	`image` text,
	`available` integer DEFAULT true NOT NULL,
	`is_bestseller` integer DEFAULT false NOT NULL,
	`is_seasonal` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
CREATE TABLE `setting` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
CREATE TABLE `variant` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`volume_ml` integer NOT NULL,
	`price` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

ALTER TABLE `order_item` ADD `stock_tracked` integer DEFAULT false NOT NULL;
ALTER TABLE `product` ADD `stock` integer;
ALTER TABLE `shop_order` ADD `sequence` integer;
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n FROM shop_order
)
UPDATE shop_order SET sequence = (SELECT n FROM numbered WHERE numbered.id = shop_order.id);
CREATE UNIQUE INDEX `shop_order_sequence_unique` ON `shop_order` (`sequence`);

ALTER TABLE `user` ADD `username` text;
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);
CREATE TABLE auth_rate_limit (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
