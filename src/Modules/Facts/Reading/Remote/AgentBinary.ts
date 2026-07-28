import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FileSystemAPI } from "../../../../Transport/index.js";
import type { TargetPlatform } from "./TargetPlatform.js";

/**
 * Where the agent lands on a target.
 *
 * `/tmp` because it is the one directory a POSIX machine is required to have and
 * to let anyone write to, and openstrap must be able to read a machine it has
 * not been given an account's home on.
 */
const targetDirectory = "/tmp/openstrap";

/**
 * Where the built agents are kept on the machine openstrap runs on.
 *
 * Overridable, because how openstrap was installed decides where its own files
 * ended up, and an operator with a prebuilt agent should not have to rebuild it
 * to put it somewhere openstrap looks.
 */
function builtAgentsDirectory(): string {
  return process.env.OPENSTRAP_FACTS_AGENT_DIR
    // Four levels up from `Facts/Reading/Remote` is the package root, whether
    // this file is being run from `src` or from `dist`.
    ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..", "dist", "agent");
}

export class MissingAgentError extends Error {
  constructor(platform: string, path: string) {
    super(
      `openstrap has no facts agent for ${platform}. Expected it at ${path}. ` +
      "Build the agents with `npm run agent:build`.",
    );
    this.name = "MissingAgentError";
  }
}

/**
 * The openstrap program that reads facts on a machine openstrap is not running
 * on.
 *
 * A guest cannot be read through the host's APIs — they answer about the host —
 * so the reading has to happen on the guest, which means the code that does the
 * reading has to get there. It travels as a self-contained executable so that
 * reading a machine never installs anything on it: no runtime, no package
 * manager, nothing left behind but a file in `/tmp`.
 *
 * The file is named after the digest of its own contents, so an unchanged agent
 * is never sent twice and a changed one can never be mistaken for the old one.
 * The digest is read from the build rather than worked out here: what a built
 * file hashes to was settled when it was built, and rediscovering it cost 63 MiB
 * of reading and 70 ms of hashing on every reading, usually to name a file that
 * was already on the target.
 */
export class AgentBinary {
  private readonly path: string;
  private readonly digest: string;

  constructor(platform: TargetPlatform, directory = builtAgentsDirectory()) {
    this.path = join(directory, `openstrap-facts-${platform.id}`);

    try {
      this.digest = readFileSync(`${this.path}.sha256`, "utf8").trim();
    } catch {
      throw new MissingAgentError(platform.id, this.path);
    }
  }

  /**
   * Puts the agent on the target if it is not already there, and says where it is.
   *
   * The one it replaces is deleted as the new one lands. A target used to keep every
   * version it had ever been sent — five of them, 315 MB of `/tmp`, on the machine
   * this was developed against — because a content-addressed name means a rebuilt
   * agent is a new file and nothing ever went back for the old one. What a machine
   * should hold is the agent it is being read with.
   *
   * Which one to delete is remembered on the target instead of found by listing the
   * directory: listing is not something a transport can be asked to do today, and
   * teaching every transport to do it to tidy up one file is the wrong trade.
   */
  async deliverTo(files: FileSystemAPI): Promise<string> {
    const delivered = files.joinPath(targetDirectory, `facts-agent-${this.digest.slice(0, 12)}`);

    if (await files.executable(delivered)) {
      return delivered;
    }

    await files.createDirectory(targetDirectory);
    await files.writeFile(delivered, readFileSync(this.path), { access: "executable" });
    await this.replace(files, delivered);

    return delivered;
  }

  /** Deletes the agent this one supersedes, and records that this one is now the agent here. */
  private async replace(files: FileSystemAPI, delivered: string): Promise<void> {
    const record = files.joinPath(targetDirectory, "facts-agent.delivered");
    const superseded = (await files.readTextFile(record))?.trim();

    if (superseded && superseded !== delivered) {
      await files.removePath(superseded, { force: true });
    }

    await files.writeTextFile(record, delivered);
  }
}
