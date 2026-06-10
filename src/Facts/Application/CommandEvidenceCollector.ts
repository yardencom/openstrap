import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { platform } from "node:os";

import type { CommandFact } from "../Definition/Domain/Entities/CommandFact.js";
import type { Redaction } from "../Definition/Domain/ValueObjects/Redaction.js";
import { RedactionStrategy } from "../Definition/Domain/ValueObjects/RedactionStrategy.js";
import { interpolateDefinitionInput } from "./DefinitionInputs.js";
import type { CommandEvidence } from "./Evidence.js";

export function collectCommandEvidence(
  commands: readonly CommandFact[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, CommandEvidence> {
  return Object.fromEntries(
    commands.map((command) => [command.id, collectCommand(command, inputs, workspaceRoot)]),
  );
}

function collectCommand(
  command: CommandFact,
  inputs: Record<string, string>,
  workspaceRoot: string,
): CommandEvidence {
  const args = (command.args ?? []).map((arg) => interpolateDefinitionInput(arg, inputs));

  if (!platformMatches(command.platforms)) {
    return {
      status: "skipped",
      command: command.name,
      args,
      reason: "platform_not_selected",
    };
  }

  try {
    const stdout = execFileSync(command.name, args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: command.timeoutMs ?? 5000,
      maxBuffer: command.maxOutputBytes ?? 1024 * 1024,
    });

    return {
      status: "success",
      command: command.name,
      args,
      stdout: applyRedaction(applyOutputLimit(stdout, command.maxOutputBytes), command.redaction),
    };
  } catch (error) {
    return {
      status: "error",
      command: command.name,
      args,
      exitCode: typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : undefined,
      stderr: typeof error === "object" && error && "stderr" in error && Buffer.isBuffer(error.stderr)
        ? applyRedaction(error.stderr.toString("utf8"), command.redaction)
        : undefined,
      reason: "command_failed",
    };
  }
}

function platformMatches(platforms: readonly string[] | undefined): boolean {
  if (!platforms || platforms.length === 0) {
    return true;
  }

  const current = platform() === "darwin" ? "macos" : platform();

  return platforms.includes(current) ||
    platforms.includes("posix") ||
    (["linux", "macos", "freebsd", "openbsd", "netbsd"].includes(current) && platforms.includes("unix"));
}

function applyOutputLimit(output: string, maxOutputBytes: number | undefined): string {
  if (!maxOutputBytes || Buffer.byteLength(output, "utf8") <= maxOutputBytes) {
    return output;
  }

  return output.slice(0, maxOutputBytes);
}

function applyRedaction(output: string, redaction: Redaction | undefined): string {
  if (!redaction || redaction === RedactionStrategy.None) {
    return output;
  }

  const strategy = typeof redaction === "string" ? redaction : redaction.strategy;

  if (strategy === RedactionStrategy.Omit) {
    return "";
  }

  if (strategy === RedactionStrategy.Hash) {
    return createHash("sha256").update(output).digest("hex");
  }

  if (strategy === RedactionStrategy.Mask) {
    if (typeof redaction === "string" || !redaction.patterns || redaction.patterns.length === 0) {
      return "[masked]";
    }

    return redaction.patterns.reduce((current, pattern) => current.replace(new RegExp(pattern, "g"), "[masked]"), output);
  }

  return output;
}
