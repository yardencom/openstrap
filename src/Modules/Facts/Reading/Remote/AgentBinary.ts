import { createHash } from "node:crypto";
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
 * The file is named after the digest of its own contents. A target therefore
 * keeps whichever versions it has been sent, an unchanged agent is never sent
 * twice, and a changed one can never be mistaken for the old one.
 */
export class AgentBinary {
  private readonly path: string;
  private readonly digest: string;

  constructor(platform: TargetPlatform, directory = builtAgentsDirectory()) {
    this.path = join(directory, `openstrap-facts-${platform.id}`);

    try {
      this.digest = createHash("sha256").update(readFileSync(this.path)).digest("hex");
    } catch {
      throw new MissingAgentError(platform.id, this.path);
    }
  }

  /** Puts the agent on the target if it is not already there, and says where it is. */
  async deliverTo(files: FileSystemAPI): Promise<string> {
    const delivered = files.joinPath(targetDirectory, `facts-agent-${this.digest.slice(0, 12)}`);

    if (await files.executable(delivered)) {
      return delivered;
    }

    await files.createDirectory(targetDirectory);
    await files.writeFile(delivered, readFileSync(this.path), { access: "executable" });

    return delivered;
  }
}
