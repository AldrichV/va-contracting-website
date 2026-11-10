CREATE TABLE `receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`vendor` text NOT NULL,
	`category` text NOT NULL,
	`job_name` text DEFAULT '' NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`receipt_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_method` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
