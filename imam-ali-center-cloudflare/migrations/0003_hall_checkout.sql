CREATE TABLE `hall_checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`payload` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`config_id` text NOT NULL,
	`attempt` text,
	`source` text,
	`order_id` text,
	`payment_id` text,
	`receipt` text,
	`notified` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
