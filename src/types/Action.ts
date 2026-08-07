import type { FileAccess } from "@openstrap/plugin-contract";

/**
 * A value a step is given, which is either the value or where to get it.
 *
 * `{ secret: "openstrap-server.master-key" }` is a name in whatever store this installation has —
 * the macOS keychain here, something else somewhere else. The blueprint holds the name; the value is
 * fetched when the step runs and is never written down.
 *
 * The store is not named. Which one holds the secret is a property of the installation, not of the
 * thing being declared, and a blueprint that named `keychain` would be a blueprint that only works
 * on one person's laptop.
 */
export type StepValue = string | { readonly secret: string };

/**
 * One thing that can be done to a machine.
 *
 * A closed union, and closed on purpose: this is not a list of conveniences that grows when someone
 * wants a new one, it is what a machine can be reached with at all. Running a program, putting a
 * file there, taking one away, and fetching bytes from elsewhere — the transport contract offers
 * three ports and this is what they do. A fifth kind would have to name a capability no channel has.
 *
 * That is what keeps the module generic. "Install a package" is not here and never will be: it is
 * `run` with an argument, and which argument depends on the machine, which is knowledge that belongs
 * to whoever knows the machine rather than to openstrap.
 *
 * Every action is data. Not a function, not a closure over a transport — a record that survives
 * `JSON.stringify`, because a plan is worked out on one machine and carried out on another, and
 * because a plan nobody can print is a plan nobody can be shown before it runs.
 */
export type Action =
  | {
      kind: "run";
      command: string;
      args: readonly string[];
      /**
       * That this was written as one shell line rather than as a program and its arguments.
       *
       * It changes nothing about running it — a shell line is already `sh -c` and its line by the
       * time it gets here. It is remembered so a plan can be printed back in the words it was
       * written in: `run curl -sfL … | sh -`, not `run sh -c curl -sfL … | sh -`.
       */
      shell?: boolean;
      /** Where to run it. The machine's default working directory when nothing says otherwise. */
      cwd?: string;
      /**
       * What the program is given, by name.
       *
       * The one place a secret may reach a step. A password is not written into a blueprint that
       * lives in a repository, and it is not an argument either — arguments are in the plan, in the
       * process list and in every error message a failed step prints.
       */
      environment?: Readonly<Record<string, StepValue>>;
      /** How long to wait before giving up on it. */
      timeoutMs?: number;
    }
  | {
      kind: "write";
      path: string;
      content: string;
      access?: FileAccess;
    }
  | {
      kind: "remove";
      path: string;
      recursive?: boolean;
    }
  | {
      /**
       * Bytes from elsewhere onto the machine.
       *
       * Here rather than left to `run curl` because `curl` is a program that may not be installed,
       * and requiring it would make the first step of every convergence a guess about the machine.
       */
      kind: "download";
      url: string;
      path: string;
      access?: FileAccess;
    };

export type { FileAccess };
