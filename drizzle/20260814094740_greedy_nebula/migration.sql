CREATE TABLE `carried_run` (
	`run_id` text PRIMARY KEY,
	`server_run` text NOT NULL,
	`carried_at` text NOT NULL,
	CONSTRAINT `fk_carried_run_run_id_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `desired_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`target` text NOT NULL,
	`revision` integer NOT NULL,
	`declaration` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_desired_state_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE,
	CONSTRAINT `desired_state_target_revision_unique` UNIQUE(`target`,`revision`)
);
--> statement-breakpoint
CREATE TABLE `fact_snapshot` (
	`id` text PRIMARY KEY,
	`target` text NOT NULL,
	`run_id` text,
	`schema_version` text NOT NULL,
	`captured_at` text NOT NULL,
	`data` text NOT NULL,
	CONSTRAINT `fk_fact_snapshot_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `machine_image` (
	`target` text PRIMARY KEY,
	`reference` text NOT NULL,
	`url` text NOT NULL,
	`sha256` text NOT NULL,
	`platform` text NOT NULL,
	`architecture` text NOT NULL,
	`format` text NOT NULL,
	`boot` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_machine_image_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `requirement_run` (
	`id` text PRIMARY KEY,
	`target` text NOT NULL,
	`run_id` text,
	`status` text NOT NULL,
	`evaluated_at` text NOT NULL,
	`results` text NOT NULL,
	CONSTRAINT `fk_requirement_run_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE,
	CONSTRAINT `fk_requirement_run_run_id_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `run` (
	`id` text PRIMARY KEY,
	`target` text NOT NULL,
	`command` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	CONSTRAINT `fk_run_target_target_name_fk` FOREIGN KEY (`target`) REFERENCES `target`(`name`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `run_image` (
	`run_id` text PRIMARY KEY,
	`reference` text NOT NULL,
	`url` text NOT NULL,
	`sha256` text NOT NULL,
	CONSTRAINT `fk_run_image_run_id_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `run_step` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`run_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`detail` text,
	CONSTRAINT `fk_run_step_run_id_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `run`(`id`) ON DELETE CASCADE,
	CONSTRAINT `run_step_run_id_ordinal_unique` UNIQUE(`run_id`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `target` (
	`name` text PRIMARY KEY,
	`scope` text NOT NULL,
	`type` text NOT NULL,
	`provider` text,
	`transport` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
