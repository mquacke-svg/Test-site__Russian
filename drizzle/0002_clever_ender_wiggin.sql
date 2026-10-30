ALTER TABLE `shop_order` ADD `sequence` integer;--> statement-breakpoint
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n FROM shop_order
)
UPDATE shop_order SET sequence = (SELECT n FROM numbered WHERE numbered.id = shop_order.id);--> statement-breakpoint
CREATE UNIQUE INDEX `shop_order_sequence_unique` ON `shop_order` (`sequence`);
