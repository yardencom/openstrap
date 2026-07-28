import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CommandDeclaration, EnvDeclaration } from "../Domain/FactDeclaration.js";
import type { CommandFact, EnvVarFact } from "../Domain/FactModel.js";
import type { Platform } from "./Platform.js";
import { Redaction } from "./Redaction.js";

const run = promisify(execFile);

const defaultTimeoutMs = 5000;
const defaultOutputLimitBytes = 1024 * 1024;

/**
 * How much output is read before the command is killed.
 *
 * Separate from what the caller asks to keep. `maxOutputBytes` says how much of
 * the answer belongs in a snapshot; a command that prints ten bytes more than
 * that has still answered, and failing it would report a working command as
 * broken.
 */
const readLimitBytes = 8 * 1024 * 1024;

/**
 * What the caller asked this machine to run, and what its environment holds.
 *
 * These are the two sections a caller spells out completely: openstrap does not
 * decide to run a program, and it does not decide which variables are
 * interesting. It runs exactly what was declared, on the machine being read, and
 * reports what came back.
 *
 * A program that fails is an error rather than an absence: the caller expected
 * it to run, so silence would be the wrong answer.
 */
export class CommandFacts {
  constructor(private readonly platform: Platform) {}

  async commands(declared: Record<string, CommandDeclaration>): Promise<Record<string, CommandFact>> {
    const facts = await Promise.all(Object.entries(declared).map(async ([id, declaration]) => {
      return [id, await this.command(declaration)] as const;
    }));

    return Object.fromEntries(facts);
  }

  /**
   * The environment variables the caller named.
   *
   * A declaration lists spellings rather than one name — `HOME` on Unix,
   * `USERPROFILE` on Windows — and the first one this machine actually sets is
   * the answer. Nothing is read that was not named: an environment copied whole
   * into a snapshot is a way to leak a token.
   */
  env(declared: Record<string, EnvDeclaration>): Record<string, EnvVarFact> {
    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      if (!this.platform.matches(declaration.platforms)) {
        return [id, {
          status: "unsupported" as const,
          name: declaration.names[0] ?? id,
          reason: "platform_not_selected",
        }];
      }

      const name = declaration.names.find((candidate) => process.env[candidate] !== undefined);

      if (name === undefined) {
        return [id, { status: "absent" as const, name: declaration.names[0] ?? id }];
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

  private async command(declaration: CommandDeclaration): Promise<CommandFact> {
    const args = [...(declaration.args ?? [])];

    if (!this.platform.matches(declaration.platforms)) {
      return {
        status: "unsupported",
        name: declaration.name,
        args,
        reason: "platform_not_selected",
      };
    }

    const redaction = new Redaction(declaration.redaction);
    const limit = declaration.maxOutputBytes ?? defaultOutputLimitBytes;

    try {
      const result = await run(declaration.name, args, {
        timeout: declaration.timeoutMs ?? defaultTimeoutMs,
        maxBuffer: readLimitBytes,
        encoding: "utf8",
      });

      return {
        status: "present",
        name: declaration.name,
        args,
        exitCode: 0,
        stdout: redaction.apply(bounded(result.stdout, limit)),
      };
    } catch (error) {
      return {
        status: "error",
        name: declaration.name,
        args,
        exitCode: exitCodeOf(error),
        stderr: redaction.apply(bounded(stderrOf(error), limit)),
        reason: "command_failed",
      };
    }
  }
}

function bounded(output: string, limitBytes: number): string {
  return Buffer.byteLength(output, "utf8") <= limitBytes ? output : output.slice(0, limitBytes);
}

function exitCodeOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
    ? error.code
    : undefined;
}

function stderrOf(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  if ("stderr" in error && typeof error.stderr === "string") {
    return error.stderr;
  }

  return "message" in error && typeof error.message === "string" ? error.message : "";
}
