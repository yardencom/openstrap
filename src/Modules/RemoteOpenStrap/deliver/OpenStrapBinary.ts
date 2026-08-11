import { MissingBinaryError } from "../errors/MissingBinaryError.js";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FileSystemAPI } from "@openstrap/plugin-contract";
import type { MachinePlatform } from "#types/Machine.js";

/** Where openstrap lands on a target. */
const targetDirectory = "/tmp/openstrap";

/** openstrap itself, built for a machine openstrap is not running on. */
export class OpenStrapBinary {
  /** Where a delivered openstrap lives, and therefore where it is started from. */
  static readonly directory = targetDirectory;

  private readonly path: string;
  private readonly digest: string;

  constructor(machine: MachinePlatform, directory = OpenStrapBinary.builtBinariesDirectory()) {
    // The name a build carries is what it runs on, which is what the machine was recorded to be.
    const platform = `${machine.platform}-${machine.architecture}`;

    this.path = join(directory, `openstrap-${platform}`);

    try {
      this.digest = readFileSync(`${this.path}.sha256`, "utf8").trim();
    } catch {
      throw new MissingBinaryError(platform, this.path);
    }
  }

  /** Puts openstrap on the target if it is not already there, and says where it landed. */
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

  /** Where openstrap's builds of itself are. */
  private static builtBinariesDirectory(): string {
    const url = import.meta.url as string | undefined;

    if (process.env.OPENSTRAP_BINARY_DIR) {
      return process.env.OPENSTRAP_BINARY_DIR;
    }

    // Four levels up from `Modules/RemoteOpenStrap/deliver` is the package root, from `src` or `dist`.
    return url === undefined
      ? dirname(process.execPath)
      : join(resolve(dirname(fileURLToPath(url)), "../../../.."), "bin");
  }
}
