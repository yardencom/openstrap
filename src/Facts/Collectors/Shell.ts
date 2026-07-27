import type { ProcessAPI } from "../../Transport/index.js";

export class ShellError extends Error {
  constructor(command: string, detail: string) {
    super(`Command failed on the target: ${command}: ${detail}`);
    this.name = "ShellError";
  }
}

/**
 * Runs commands on whatever machine the transport reaches.
 *
 * Collectors take this rather than a whole transport: reading facts needs to
 * run commands and nothing else, and a narrower dependency is a narrower thing
 * to reason about.
 */
export class Shell {
  constructor(private readonly processes: ProcessAPI) {}

  /** Runs a command, failing loudly. Silence would look like an absent fact. */
  async run(command: string): Promise<string> {
    const result = await this.processes.capture({ command: "sh", args: ["-c", command], cwd: "/" });

    if (result.exitCode !== 0) {
      throw new ShellError(command, result.stderr.trim() || `exit ${result.exitCode}`);
    }

    return result.stdout;
  }

  /** Runs a command whose failure is an answer rather than a fault. */
  async output(command: string): Promise<string | null> {
    const result = await this.processes.capture({ command: "sh", args: ["-c", command], cwd: "/" });

    return result.exitCode === 0 ? result.stdout.trim() : null;
  }

  async succeeds(command: string): Promise<boolean> {
    return this.processes.succeeds({ command: "sh", args: ["-c", command], cwd: "/", stdio: "ignore" });
  }

  /** Splits output into non-empty trimmed lines, which is how tools answer. */
  async lines(command: string): Promise<string[]> {
    const output = await this.output(command);

    return (output ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
