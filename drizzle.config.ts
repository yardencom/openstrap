import { defineConfig } from "drizzle-kit";

/**
 * How the statements that build this schema are produced.
 *
 * They are generated, not written: openstrap's store is a file on somebody's disk that has to become
 * whatever the schema says next, and working out the difference between the two is what a migration
 * is. `npm run schema:migrations` regenerates them and folds them into `src/Store/Migrations.ts`,
 * which is what ships — a single executable reads no files of its own (ADR 0001).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/Store/Schema.ts",
  out: "./drizzle",
});
