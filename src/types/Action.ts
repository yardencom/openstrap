import type { FileAccess } from "@openstrap/plugin-contract";

/** A value a step is given: the value, or the name of a secret to fetch it by. */
export type StepValue = string | { readonly secret: string };

/** One thing that can be done to a machine. */
export type Action =
  | {
      kind: "run";
      command: string;
      args: readonly string[];
      /** Written as a shell line. Remembered only so a plan prints back in the words it was written in. */
      shell?: boolean;
      /** Where to run it. The machine's default working directory when nothing says otherwise. */
      cwd?: string;
      /** The one place a secret may reach a step. */
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
      /** Here rather than `run curl`, which would make every convergence start with a guess. */
      kind: "download";
      url: string;
      path: string;
      access?: FileAccess;
    };

export type { FileAccess };
