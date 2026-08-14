import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { Migrate } from "../Migrate.js";
import { Store } from "../Store.js";

const first = {
  name: "0001_first",
  statements: ["CREATE TABLE machine (name TEXT PRIMARY KEY)"],
};

const second = {
  name: "0002_a_column_later",
  statements: ["ALTER TABLE machine ADD COLUMN size TEXT"],
};

function columnsOf(database: DatabaseSync, table: string): string[] {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
}

describe("Bringing a database up to what the schema says", () => {
  it("applies what is pending and remembers it", () => {
    const database = new DatabaseSync(":memory:");

    expect(new Migrate(database, [first]).apply()).toBe(1);
    expect(columnsOf(database, "machine")).toEqual(["name"]);
  });

  it("applies nothing the second time, because each step runs once", () => {
    const database = new DatabaseSync(":memory:");

    new Migrate(database, [first]).apply();

    expect(new Migrate(database, [first]).apply()).toBe(0);
  });

  /**
   * The whole reason this exists.
   *
   * A database made a release ago has the tables of a release ago. An idempotent create would look at
   * `machine`, find it there, and do nothing — leaving a column the code now reads missing, with no
   * error until something selects it.
   */
  it("gives a database made earlier the column it never had", () => {
    const database = new DatabaseSync(":memory:");

    new Migrate(database, [first]).apply();
    database.prepare("INSERT INTO machine (name) VALUES (?)").run("ubuntu-vm");

    expect(new Migrate(database, [first, second]).apply()).toBe(1);
    expect(columnsOf(database, "machine")).toEqual(["name", "size"]);
    // The rows that were there are still there: a migration is not a fresh start.
    expect(database.prepare("SELECT name FROM machine").all()).toEqual([{ name: "ubuntu-vm" }]);
  });

  it("leaves the database as it was when a step fails halfway", () => {
    const database = new DatabaseSync(":memory:");
    const broken = { name: "0002_broken", statements: ["ALTER TABLE machine ADD COLUMN size TEXT", "NOT SQL"] };

    new Migrate(database, [first]).apply();

    expect(() => new Migrate(database, [first, broken]).apply()).toThrow();
    expect(columnsOf(database, "machine")).toEqual(["name"]);
  });

  it("is what a store does on the way up, so opening one twice is not two attempts", () => {
    const store = new Store(":memory:");

    store.machines.save({ name: "ubuntu-vm", scope: "guest", type: "vm", transport: "ssh" }, "2026-08-14T10:00:00.000Z");

    expect(store.machines.read("ubuntu-vm")).toMatchObject({ name: "ubuntu-vm" });

    store.close();
  });
});
