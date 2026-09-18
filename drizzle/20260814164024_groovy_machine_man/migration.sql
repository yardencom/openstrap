PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_machine_image` (
	`target` text PRIMARY KEY,
	`reference` text NOT NULL,
	`url` text NOT NULL,
	`sha256` text,
	`platform` text NOT NULL,
	`architecture` text NOT NULL,
	`format` text NOT NULL,
	`boot` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_machine_image_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_machine_image`(`target`, `reference`, `url`, `sha256`, `platform`, `architecture`, `format`, `boot`, `created_at`) SELECT `target`, `reference`, `url`, `sha256`, `platform`, `architecture`, `format`, `boot`, `created_at` FROM `machine_image`;--> statement-breakpoint
DROP TABLE `machine_image`;--> statement-breakpoint
ALTER TABLE `__new_machine_image` RENAME TO `machine_image`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_run_image` (
	`run_id` text PRIMARY KEY,
	`reference` text NOT NULL,
	`url` text NOT NULL,
	`sha256` text,
	CONSTRAINT `fk_run_image_run_id_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_run_image`(`run_id`, `reference`, `url`, `sha256`) SELECT `run_id`, `reference`, `url`, `sha256` FROM `run_image`;--> statement-breakpoint
DROP TABLE `run_image`;--> statement-breakpoint
ALTER TABLE `__new_run_image` RENAME TO `run_image`;--> statement-breakpoint
PRAGMA foreign_keys=ON;