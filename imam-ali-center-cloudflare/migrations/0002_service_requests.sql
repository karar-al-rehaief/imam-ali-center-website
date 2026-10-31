CREATE TABLE `service_request_limits` (
	`ip` text NOT NULL,
	`hour` integer NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`ip`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`payload` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_requests_created` ON `service_requests` (`created_at`);