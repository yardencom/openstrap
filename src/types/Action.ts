import type { FileAccess } from "@openstrap/plugin-contract";

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
      environment?: Readonly<Record<string, string>>;
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
