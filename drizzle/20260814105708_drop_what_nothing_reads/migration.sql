-- Three tables openstrap stopped writing and never read again.
--
-- `allocated_port` recorded which host port was forwarded, and the provider forwarding it answers
-- that on request. `provider_resource` recorded a machine's id, and `provider.find(name)` answers
-- that. `secret_reference` recorded where a key was kept, and keys became the transport's.
--
-- Written by hand because there is nothing to generate them from: a schema describes what is, and
-- these have not been in it since they were removed. Drizzle can only diff against what it knows.
DROP TABLE IF EXISTS allocated_port;
--> statement-breakpoint
DROP TABLE IF EXISTS provider_resource;
--> statement-breakpoint
DROP TABLE IF EXISTS secret_reference;
