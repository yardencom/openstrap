import type { ProcessFact, ServiceFact } from "./Inventory.js";

export type ProcessDeclaration = {
  name?: string;
  command?: string;
};

export type ServiceDeclaration = {
  name?: string;
  manager?: string;
};

export type DeclaredProcessFact = {
  status: "present" | "absent";
  pids: number[];
  pid?: number;
  user?: string;
  state?: string;
  name?: string;
  command?: string;
};

export type DeclaredServiceFact = ServiceFact | { status: "absent"; name: string };

/**
 * Answers questions asked by name against an inventory read by identity.
 *
 * A declaration says "the process called node"; the inventory says "pid 4711".
 * Matching one to the other is a responsibility of its own — the inventory
 * should not have to know what anyone is going to ask about it, and a
 * declaration should not have to know pids.
 *
 * A declared entity that matches nothing is `absent`, not missing. A caller
 * asked about it, so silence would be the wrong answer.
 */
export class DeclaredEntities {
  processes(
    declarations: Readonly<Record<string, ProcessDeclaration>>,
    inventory: Readonly<Record<string, ProcessFact>>,
  ): Record<string, DeclaredProcessFact> {
    const found = Object.values(inventory);

    return Object.fromEntries(
      Object.entries(declarations).map(([id, declaration]) => {
        const matches = found.filter((entry) => this.matchesProcess(entry, declaration));
        const [first] = matches;

        if (!first) {
          return [id, { status: "absent" as const, pids: [] }];
        }

        return [id, {
          status: "present" as const,
          pids: matches.map((entry) => entry.pid),
          pid: first.pid,
          user: first.user,
          state: first.state,
          name: first.name,
          command: first.command,
        }];
      }),
    );
  }

  services(
    declarations: Readonly<Record<string, ServiceDeclaration>>,
    inventory: Readonly<Record<string, ServiceFact>>,
  ): Record<string, DeclaredServiceFact> {
    return Object.fromEntries(
      Object.entries(declarations).map(([id, declaration]) => {
        const wanted = declaration.name ?? id;
        const match = inventory[wanted]
          ?? Object.values(inventory).find((entry) => entry.name === wanted);

        return [id, match ?? { status: "absent" as const, name: wanted }];
      }),
    );
  }

  private matchesProcess(entry: ProcessFact, declaration: ProcessDeclaration): boolean {
    if (declaration.name !== undefined && !this.mentions(entry.name, declaration.name)) {
      return false;
    }

    if (declaration.command !== undefined && !this.mentions(entry.command, declaration.command)) {
      return false;
    }

    return declaration.name !== undefined || declaration.command !== undefined;
  }

  /** A process is named by its path as often as by its command, so both count. */
  private mentions(value: string | undefined, wanted: string): boolean {
    if (!value) {
      return false;
    }

    const basename = value.slice(value.lastIndexOf("/") + 1);

    return basename === wanted || value === wanted || basename.startsWith(`${wanted}.`);
  }
}
