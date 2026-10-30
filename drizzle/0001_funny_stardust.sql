ALTER TABLE `order_item` ADD `stock_tracked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `stock` integer;