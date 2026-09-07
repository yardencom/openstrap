import { execFileSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { cpSync, mkdtempSync, rmSync } from "node:fs";

import type { Transport } from "@openstrap/plugin-contract";

/**
 * Files this machine has that a target needs to have.
 *
 * A step is carried out on the machine — openstrap delivers itself there and runs — so a step can
 * write what it was given and fetch what has a URL, and can reach nothing on the computer that
 * asked for the run. Which left a whole class of thing undeclarable: an application's own source,
 * its manifests, anything that lives in the repository beside the blueprint and is published
 * nowhere. The blueprint could describe the machine and not what was to go on it.
 *
 * So this happens from here, before the steps do: openstrap is already holding a transport to the
 * machine to deliver itself over, and the same channel carries anything else.
 *
 * A directory goes as one archive rather than as its files. Writing them one by one opened a
 * channel per file and the transport ran out partway through a source tree — and the fix is not
 * more channels, because a thousand round trips over ssh is slow even when it works.
 */
export class Delivered {
  constructor(private readonly declared: Readonly<Record<string, string>> = {}) {}

  /**
   * The same thing, with what a blueprint said read against where the blueprint is.
   *
   * A path in a blueprint is relative to it, because a blueprint is a file in a repository and the
   * repository is what its paths are about — not whichever directory somebody happened to run from.
   */
  static from(declared: Readonly<Record<string, string>> | undefined, root: string): Delivered {
    return new Delivered(Object.fromEntries(
      Object.entries(declared ?? {}).map(([from, to]) => [isAbsolute(from) ? from : join(root, from), to]),
    ));
  }

  /**
   * Puts everything where it was said to go, as one archive.
   *
   * One, and not one per entry: every operation over ssh is a channel, and a handful of entries was
   * already enough to run a connection out of them. What is declared here is small — a source tree,
   * some manifests — so the whole of it travels once and is unpacked once.
   */
  async onto(transport: Transport): Promise<readonly string[]> {
    const entries = Object.entries(this.declared);

    if (entries.length === 0) {
      return [];
    }

    const staged = "/tmp/openstrap-delivery";

    await transport.fileSystem.writeFile(`${staged}.tar`, Delivered.packed(entries));
    await transport.processes.run({
      // Unpacked into place and the archive taken away, in one visit: `sh -c` because this is three
      // things that only make sense together, and three visits is three channels.
      command: "sh",
      args: [
        "-c",
        `set -e; rm -rf ${staged}; mkdir -p ${staged}; tar xf ${staged}.tar -C ${staged}; `
        + entries.map(([, to], at) => `mkdir -p $(dirname ${to}); rm -rf ${to}; mv ${staged}/${at} ${to}`).join("; ")
        + `; rm -rf ${staged} ${staged}.tar`,
      ],
      cwd: "/tmp",
      stdio: "ignore",
    });

    return entries.map(([, to]) => to);
  }

  /**
   * Everything declared, under a number each, so that a name on this computer decides nothing there.
   *
   * `._name` and `.DS_Store` are left out: macOS writes both beside real files, and `kubectl apply`
   * on one of them fails on control characters — which is how this was found. `node_modules` is
   * left out because a build makes its own from the lock file and it is tens of thousands of files.
   */
  private static packed(entries: readonly (readonly [string, string])[]): Buffer {
    const staging = // Not `node:os`: what openstrap delivers to a machine reads nothing about the one it runs on.
      mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "openstrap-deliver-"));

    entries.forEach(([from], at) => {
      cpSync(from, join(staging, String(at)), {
        recursive: true,
        filter: (path) => !/(^|\/)(\._|\.DS_Store$|node_modules$)/.test(path),
      });
    });

    try {
      // `COPYFILE_DISABLE` because macOS `tar` writes a `._name` beside every file that has extended
      // attributes — files that exist in the archive and not on disk, so no filter here catches them.
      // They arrived as `._001_initial.sql`, were read as SQL, and postgres said `invalid message
      // format` from inside a migration.
      return execFileSync("tar", ["-cf", "-", "."], {
        cwd: staging,
        maxBuffer: 512 * 1024 * 1024,
        env: { ...process.env, COPYFILE_DISABLE: "1" },
      });
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}

