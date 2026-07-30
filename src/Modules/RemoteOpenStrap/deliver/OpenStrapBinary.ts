import { MissingBinaryError } from "../errors/MissingBinaryError.js";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FileSystemAPI } from "../../../Transport/index.js";
import type { MachinePlatform } from "#types/Machine.js";

/**
 * Where openstrap lands on a target.
 *
 * `/tmp` because it is the one directory a POSIX machine is required to have and
 * to let anyone write to, and openstrap must be able to read a machine it has
 * not been given an account's home on.
 */
const targetDirectory = "/tmp/openstrap";

/**
 * Where openstrap's builds of itself are.
 *
 * The same build that put openstrap on this machine puts it on the next one: `npm run binaries`
 * produces one executable per platform, and delivering is choosing the one the target runs.
 *
 * Two ways of asking where they are, because there are two ways openstrap runs. From `src` or `dist`
 * this file has a path of its own and they sit beside the repository. Bundled into a single
 * executable it does not — `import.meta` is empty there — and then they sit beside that executable.
 * `OPENSTRAP_BINARY_DIR` overrides both, because how openstrap was installed decides where its files
 * ended up.
 */
function builtBinariesDirectory(): string {
  const url = import.meta.url as string | undefined;

  if (process.env.OPENSTRAP_BINARY_DIR) {
    return process.env.OPENSTRAP_BINARY_DIR;
  }

  // Four levels up from `Modules/RemoteOpenStrap/deliver` is the package root, from `src` or `dist`.
  return url === undefined
    ? dirname(process.execPath)
    : join(resolve(dirname(fileURLToPath(url)), "../../../.."), "bin");
}


/**
 * openstrap itself, built for a machine openstrap is not running on.
 *
 * Not a separate program: a target is read by openstrap, so what goes there is
 * openstrap. It travels as a self-contained executable — the Node runtime is
 * inside it — so that reading a machine installs nothing on it: no runtime, no
 * package manager, nothing left behind but a file in `/tmp`.
 *
 * A build for the machine's platform has to exist, because a build for one does
 * not run on another. That is the same set of builds a release has to produce
 * anyway, which is the point of sending openstrap rather than something written
 * to be sent.
 *
 * The file is named after the digest of its own contents, so an unchanged build
 * is never sent twice and a changed one can never be mistaken for the old one.
 * The digest is read from the build rather than worked out here: what a built
 * file hashes to was settled when it was built, and rediscovering it cost 63 MiB
 * of reading and 70 ms of hashing on every reading, usually to name a file that
 * was already on the target.
 */
export class OpenStrapBinary {
  private readonly path: string;
  private readonly digest: string;

  constructor(machine: MachinePlatform, directory = builtBinariesDirectory()) {
    // The name a build carries is what it runs on, which is what the machine was recorded to be.
    const platform = `${machine.platform}-${machine.architecture}`;

    this.path = join(directory, `openstrap-${platform}`);

    try {
      this.digest = readFileSync(`${this.path}.sha256`, "utf8").trim();
    } catch {
      throw new MissingBinaryError(platform, this.path);
    }
  }

  /**
   * Puts openstrap on the target if it is not already there, and says where it landed.
   *
   * The one it replaces is deleted as the new one lands. A target used to keep every
   * version it had ever been sent — five of them, 315 MB of `/tmp`, on the machine
   * this was developed against — because a content-addressed name means a rebuilt
   * binary is a new file and nothing ever went back for the old one. What a machine
   * should hold is the openstrap it is being read with.
   *
   * Which one to delete is remembered on the target instead of found by listing the
   * directory: listing is not something a transport can be asked to do today, and
   * teaching every transport to do it to tidy up one file is the wrong trade.
   */
  async deliverTo(files: FileSystemAPI): Promise<string> {
    const delivered = files.joinPath(targetDirectory, `openstrap-${this.digest.slice(0, 12)}`);

    if (await files.executable(delivered)) {
      return delivered;
    }

    await files.createDirectory(targetDirectory);
    await files.writeFile(delivered, readFileSync(this.path), { access: "executable" });
    await this.replace(files, delivered);

    return delivered;
  }

  /** Deletes the build this one supersedes, and records that this one is now the openstrap here. */
  private async replace(files: FileSystemAPI, delivered: string): Promise<void> {
    const record = files.joinPath(targetDirectory, "openstrap.delivered");
    const superseded = (await files.readTextFile(record))?.trim();

    if (superseded && superseded !== delivered) {
      await files.removePath(superseded, { force: true });
    }

    await files.writeTextFile(record, delivered);
  }
}
