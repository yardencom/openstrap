#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import {
  BlueprintDocumentReadError,
  BlueprintValidationError,
} from "../Blueprint/index.js";
import type { FactCollection } from "../FactsRuntime/index.js";
import { OpenStrapRun } from "../OpenStrapRun/index.js";
import {
  type RequirementCheckNode,
  type RequirementLeafCheck,
  type RequirementRun,
} from "../Requirements/index.js";

export type OpenStrapRunOutput = {
  targets: Array<{
    name: string;
    scope: string;
    type: string;
    transport: string;
  }>;
  facts: FactCollection;
  requirementRun: RequirementRun;
};

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  cwd: string;
};

type ParsedArgs = {
  command: "run";
  configPath?: string;
  json: boolean;
};

export function runOpenStrapFlow(params: {
  configPath?: string;
  workspaceRoot: string;
  now?: Date;
}): OpenStrapRunOutput {
  const result = new OpenStrapRun().execute(params);

  return {
    targets: result.blueprint.targets,
    facts: result.facts,
    requirementRun: result.requirementRun,
  };
}

export async function runCli(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  let parsedArgs: ParsedArgs;

  try {
    parsedArgs = parseArgs(argv);
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
    return 2;
  }

  try {
    const output = runOpenStrapFlow({
      configPath: parsedArgs.configPath,
      workspaceRoot: io.cwd,
    });

    io.stdout.write(parsedArgs.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : renderHumanOutput(output));

    return output.requirementRun.status === "passed" || output.requirementRun.status === "skipped" ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (command !== "run") {
    throw new Error(command ? `Unknown command "${command}"` : "Missing command");
  }

  let json = false;
  let configPath: string | undefined;

  for (const arg of rest) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}"`);
    }

    if (configPath) {
      throw new Error("Only one config path can be provided");
    }

    configPath = arg;
  }

  return {
    command,
    configPath,
    json,
  };
}

function renderHumanOutput(output: OpenStrapRunOutput): string {
  const lines: string[] = [];

  lines.push(`OpenStrap run: ${output.requirementRun.status}`);
  lines.push("");
  lines.push("Targets:");

  for (const item of output.facts) {
    lines.push(
      `  - ${item.snapshot.target.id} (${item.snapshot.scope}/${item.snapshot.target.type}) ` +
      `snapshot=${item.snapshot.id} factRun=${item.run.id}`,
    );
  }

  lines.push("");
  lines.push("Requirements:");

  for (const result of output.requirementRun.results) {
    lines.push(`  - ${result.requirementId} [${result.target}]: ${result.status}`);

    for (const leaf of flattenChecks(result.checks)) {
      if (leaf.check.status === "passed") {
        continue;
      }

      lines.push(
        `      ${leaf.path}: ${leaf.check.status}; expected=${JSON.stringify(leaf.check.expected?.value ?? null)} ` +
        `actual=${JSON.stringify(leaf.check.actual)}${leaf.check.details?.message ? `; ${leaf.check.details.message}` : ""}`,
      );
    }
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
}

function flattenChecks(node: RequirementCheckNode, path: readonly string[] = []): Array<{
  path: string;
  check: RequirementLeafCheck;
}> {
  if (isLeafCheck(node)) {
    return [{
      path: path.join("."),
      check: node,
    }];
  }

  return Object.entries(node).flatMap(([key, value]) => flattenChecks(value, [...path, key]));
}

function isLeafCheck(value: RequirementCheckNode): value is RequirementLeafCheck {
  return Boolean(
    value &&
    typeof value === "object" &&
    "status" in value &&
    "expected" in value &&
    "actual" in value,
  );
}

function formatError(error: unknown): string {
  if (error instanceof BlueprintDocumentReadError || error instanceof BlueprintValidationError) {
    return [
      error.message,
      ...error.issues.map((issue) => `  - ${issue}`),
    ].join("\n");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function usage(): string {
  return "Usage: openstrap run [configPath] [--json]";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
