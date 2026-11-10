CREATE TABLE `estimates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`jobsite_id` integer,
	`estimate_number` text NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`project_address` text DEFAULT '' NOT NULL,
	`project_type` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`total_cents` integer NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jobsite_id`) REFERENCES `jobsites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `receipts` ADD `attachment_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `attachment_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `attachment_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `attachment_size` integer DEFAULT 0 NOT NULL;