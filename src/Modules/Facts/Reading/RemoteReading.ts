import type { Transport } from "../../../Transport/index.js";
import type { FactDeclaration } from "../Domain/FactDeclaration.js";
import type { FactData } from "../Domain/FactModel.js";
import { AgentBinary } from "./Remote/AgentBinary.js";
import { TargetPlatform } from "./Remote/TargetPlatform.js";
import type { SystemReading } from "./SystemReading.js";

export class RemoteReadingError extends Error {
  constructor(detail: string) {
    super(`The facts agent did not answer: ${detail}`);
    this.name = "RemoteReadingError";
  }
}

/**
 * Reading a machine openstrap is not running on.
 *
 * The reading itself is not done here. It is done by openstrap on the target, by
 * exactly the code that reads the host, and this only arranges for that to
 * happen: work out what the target is, put the agent there, ask it, and hand back
 * what it said.
 *
 * That indirection is the point. A guest read through the host's APIs would
 * produce facts about the host, and a guest read by parsing the output of the
 * guest's programs would produce a second implementation that drifts from the
 * first. Running the same program in both places is what makes a host snapshot
 * and a guest snapshot mean the same thing.
 */
export class RemoteReading implements SystemReading {
  constructor(private readonly transport: Transport) {}

  async read(declaration: FactDeclaration = {}): Promise<FactData> {
    const platform = await TargetPlatform.detect(this.transport.fileSystem);
    const agent = await new AgentBinary(platform).deliverTo(this.transport.fileSystem);
    // Base64 rather than the JSON itself: the request travels as one argument
    // through whatever shell the transport uses to start a process, and an
    // encoding with no quotes, spaces or newlines in it cannot be reinterpreted
    // on the way.
    const request = Buffer.from(JSON.stringify(declaration), "utf8").toString("base64");
    const result = await this.transport.processes.capture({
      command: agent,
      args: ["--declaration", request],
      cwd: "/",
    });

    if (result.exitCode !== 0) {
      throw new RemoteReadingError(result.stderr.trim() || `exit ${result.exitCode}`);
    }

    return this.parse(result.stdout);
  }

  /**
   * What the agent printed, which is a snapshot's data and nothing else.
   *
   * Anything unparseable is a failure rather than an empty reading: a machine
   * that answered with noise has not been read, and reporting no facts would
   * make that look like a machine with nothing on it.
   */
  private parse(output: string): FactData {
    let parsed: unknown;

    try {
      parsed = JSON.parse(output);
    } catch {
      throw new RemoteReadingError(`its answer was not JSON: ${output.slice(0, 200)}`);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RemoteReadingError("its answer was not a set of fact sections");
    }

    return parsed as FactData;
  }
}
