import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CommandDeclaration, EnvDeclaration } from "#types/FactDeclaration.js";
import type { CommandFact, EnvVarFact } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";
import { Redaction } from "../redaction/Redaction.js";

const run = promisify(execFile);

const defaultTimeoutMs = 5000;
const defaultOutputLimitBytes = 1024 * 1024;

/** How much output is read before the command is killed. */
const readLimitBytes = 8 * 1024 * 1024;

/** What the caller asked this machine to run, and what its environment holds. */
export class CommandFacts {
  constructor(private readonly platform: Platform) {}

  async commands(declared: Record<string, CommandDeclaration> | undefined): Promise<Record<string, CommandFact>> {
    if (declared === undefined) {
      return {};
    }

    const facts = await Promise.all(Object.entries(declared).map(async ([id, declaration]) => {
      return [id, await this.command(declaration.name ?? id, declaration)] as const;
    }));

    return Object.fromEntries(facts);
  }

  /** The environment variables the caller named. */
  env(declared: Record<string, EnvDeclaration> | undefined): Record<string, EnvVarFact> {
    if (declared === undefined) {
      return {};
    }

    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      // A variable is spelled the way it is named, unless the declaration lists the spellings —
      // `HOME` on Unix and `USERPROFILE` on Windows are one variable under two names.
      const spellings = declaration.names ?? [id];

      if (!this.platform.matches(declaration.platforms)) {
        return [id, {
          status: "unsupported" as const,
          name: spellings[0] ?? id,
          reason: "platform_not_selected",
        }];
      }

      const name = spellings.find((candidate) => process.env[candidate] !== undefined);

      if (name === undefined) {
        return [id, { status: "absent" as const, name: spellings[0] ?? id }];
      }

      const redaction = new Redaction(declaration.redaction);

      return [id, {
        status: "present" as const,
        name,
        value: redaction.apply(process.env[name] ?? ""),
        redacted: redaction.redacted,
      }];
    }));
  }

  private async command(program: string, declaration: CommandDeclaration): Promise<CommandFact> {
    const args = [...(declaration.args ?? [])];

    if (!this.platform.matches(declaration.platforms)) {
      return {
        status: "unsupported",
        name: program,
        args,
        reason: "platform_not_selected",
      };
    }

    const redaction = new Redaction(declaration.redaction);
    const limit = declaration.maxOutputBytes ?? defaultOutputLimitBytes;

    try {
      const result = await run(program, args, {
        timeout: declaration.timeoutMs ?? defaultTimeoutMs,
        maxBuffer: readLimitBytes,
        encoding: "utf8",
      });

      return {
        status: "present",
        name: program,
        args,
        exitCode: 0,
        stdout: redaction.apply(CommandFacts.bounded(result.stdout, limit)),
      };
    } catch (error) {
      return {
        status: "error",
        name: program,
        args,
        exitCode: CommandFacts.exitCodeOf(error),
        stderr: redaction.apply(CommandFacts.bounded(CommandFacts.stderrOf(error), limit)),
        reason: "command_failed",
      };
    }
  }

  private static bounded(output: string, limitBytes: number): string {
    return Buffer.byteLength(output, "utf8") <= limitBytes ? output : output.slice(0, limitBytes);
  }

  private static exitCodeOf(error: unknown): number | undefined {
    return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
      ? error.code
      : undefined;
  }

  private static stderrOf(error: unknown): string {
    if (typeof error !== "object" || error === null) {
      return "";
    }

    if ("stderr" in error && typeof error.stderr === "string") {
      return error.stderr;
    }

    return "message" in error && typeof error.message === "string" ? error.message : "";
  }
}
