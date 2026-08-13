import { drizzle } from "drizzle-orm/node-sqlite";

/** The queries, as everything below the three keepers is allowed to know about them. */
export type Database = ReturnType<typeof drizzle>;
