import { readFileSync, writeFileSync } from "node:fs";

import { parse, stringify } from "yaml";

export type LockedImage = {
  resolved: string;
  sha256: string;
  signature: "verified" | "unsigned";
  arch: string;
  format: string;
  boot: string;
};

export type LockedTarget = {
  image: LockedImage;
  plugins: Record<string, string>;
};

export type LockedContents = {
  targets: Record<string, LockedTarget>;
};

const header = [
  "# openstrap.lock.yaml — generated, not edited by hand.",
  "#",
  "# Only what is the same for everyone who clones this repository: the resolved",
  "# image, its checksum, its format and the plugin versions. Anything true of one",
  "# machine only — reserved ports, provider resource ids, runs — lives in the",
  "# state store and never here.",
  "",
].join("\n");

/**
 * The record of what a run actually used, so a repeat gives the same result.
 *
 * It is not a report derived from the state store. Were it one, the file in
 * git would differ for every developer, which is the opposite of what a lock
 * file is for.
 */
export class LockFile {
  constructor(private readonly path: string) {}

  read(): LockedContents {
    try {
      const parsed = parse(readFileSync(this.path, "utf8")) as LockedContents | null;

      return parsed?.targets ? parsed : { targets: {} };
    } catch {
      return { targets: {} };
    }
  }

  /** Recording a target replaces its entry and leaves the others untouched. */
  record(name: string, target: LockedTarget): LockedContents {
    const contents = this.read();
    const targets = { ...contents.targets, [name]: target };
    const ordered = Object.fromEntries(
      Object.keys(targets).sort().map((key) => [key, targets[key]!]),
    );
    const next: LockedContents = { targets: ordered };

    writeFileSync(this.path, `${header}${stringify(next)}`, "utf8");

    return next;
  }
}
