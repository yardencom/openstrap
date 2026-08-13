import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

import { Carried } from "./Carried.js";
import { Machines } from "./Machines.js";
import { Runs } from "./Runs.js";
import { stateStoreSchema } from "./Schema.js";

/**
 * What openstrap knows about the machines of this one computer.
 *
 * Three things are kept and they answer three different questions, so they are three objects rather
 * than one class with everything on it: what a machine was declared to be and made from
 * (`machines`), what happened to it (`runs`), and which of that a server has already been told
 * (`carried`). Anything that reads a machine's actual state asks the machine or its provider — none
 * of that is here, and a second copy of it is the thing this deliberately does not become.
 */
export class Store {
  readonly machines: Machines;
  readonly runs: Runs;
  readonly carried: Carried;

  private readonly sqlite: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec("PRAGMA foreign_keys = ON");

    for (const statement of stateStoreSchema) {
      this.sqlite.exec(statement);
    }

    const database = drizzle({ client: this.sqlite });

    this.machines = new Machines(database);
    this.runs = new Runs(database);
    this.carried = new Carried(database, this.machines, this.runs);
  }

  close(): void {
    this.sqlite.close();
  }
}
