-- A table from before the one that replaced it.
--
-- `machine_platform` said what kind of machine a target was; `machine_image` says that and what it
-- was made from, in one row, because two rows about one thing drift (ADR 0003). The replacement
-- landed and the old table stayed behind, unread, in every database made before it.
DROP TABLE IF EXISTS machine_platform;
