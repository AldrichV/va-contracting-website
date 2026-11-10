CREATE TABLE IF NOT EXISTS `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`project_type` text DEFAULT '' NOT NULL,
	`rating` integer DEFAULT 5 NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderation_reason` text DEFAULT '' NOT NULL,
	`moderated_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`moderated_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `testimonials_status_idx` ON `testimonials` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `testimonials_created_at_idx` ON `testimonials` (`created_at`);
