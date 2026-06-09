#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BlueprintDocumentReadError,
  BlueprintValidationError,
} from "../Blueprint/index.js";
import {
  FactsDefinitionCollector,
  FactsResultStore,
  type FactCollection,
  type StoredFactsDefinitionCollectResult,
} from "../Facts/index.js";
import { OpenStrapRun } from "../OpenStrapRun/index.js";
import {
  createOpenStrapRuntime,
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  OpenStrapPluginError,
  type FactsBackend,
} from "../Plugin/index.js";
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

type RuntimeArgs = {
  runtimeConfigPath?: string;
  pluginSpecifiers: string[];
  factsBackendId?: string;
};

type RunArgs = {
  command: "run";
  configPath?: string;
  json: boolean;
} & RuntimeArgs;

type FactsCollectArgs = {
  command: "facts.collect";
  target: "host";
  configPath: string;
  json: boolean;
  inputs: Record<string, string>;
} & RuntimeArgs;

type ParsedArgs = RunArgs | FactsCollectArgs;

export function runOpenStrapFlow(params: {
  configPath?: string;
  workspaceRoot: string;
  factsBackend?: FactsBackend;
  now?: Date;
}): Promise<OpenStrapRunOutput> {
  return new OpenStrapRun(undefined, undefined, params.factsBackend).execute(params).then((result) => ({
    targets: result.blueprint.targets,
    facts: result.facts,
    requirementRun: result.requirementRun,
  }));
}

async function createCliRuntime(parsedArgs: ParsedArgs, cwd: string) {
  const config = await loadOpenStrapPluginConfig({
    cwd,
    configPath: parsedArgs.runtimeConfigPath,
  });
  const plugins = await Promise.all(parsedArgs.pluginSpecifiers.map((specifier) => {
    return loadOpenStrapPlugin({
      cwd,
      specifier,
    });
  }));

  return createOpenStrapRuntime({
    config,
    plugins,
    factsBackendId: parsedArgs.factsBackendId,
  });
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
    const runtime = await createCliRuntime(parsedArgs, io.cwd);

    if (parsedArgs.command === "facts.collect") {
      const output = await new FactsDefinitionCollector(undefined, runtime.factsBackend).collect({
        path: parsedArgs.configPath,
        workspaceRoot: io.cwd,
        inputs: parsedArgs.inputs,
      });
      const storedOutput = new FactsResultStore().storeCollectedFacts({
        workspaceRoot: io.cwd,
        result: output,
      });

      io.stdout.write(parsedArgs.json
        ? `${JSON.stringify(storedOutput, null, 2)}\n`
        : renderFactsCollectOutput(storedOutput));

      return output.facts.some((item) => item.run.status === "error") ? 1 : 0;
    }

    const output = runOpenStrapFlow({
      configPath: parsedArgs.configPath,
      workspaceRoot: io.cwd,
      factsBackend: runtime.factsBackend,
    });
    const awaitedOutput = await output;

    io.stdout.write(parsedArgs.json
      ? `${JSON.stringify(awaitedOutput, null, 2)}\n`
      : renderHumanOutput(awaitedOutput));

    return awaitedOutput.requirementRun.status === "passed" || awaitedOutput.requirementRun.status === "skipped" ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (command === "facts") {
    return parseFactsArgs(rest);
  }

  if (command !== "run") {
    throw new Error(command ? `Unknown command "${command}"` : "Missing command");
  }

  let json = false;
  let configPath: string | undefined;
  const runtimeOptions = createRuntimeArgs();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]!;

    if (arg === "--json") {
      json = true;
      continue;
    }

    const runtimeOptionIndex = readRuntimeOption(rest, index, runtimeOptions);
    if (runtimeOptionIndex !== undefined) {
      index = runtimeOptionIndex;
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
    ...runtimeOptions,
  };
}

function parseFactsArgs(argv: readonly string[]): FactsCollectArgs {
  const [subcommand, ...rest] = argv;

  if (subcommand !== "collect") {
    throw new Error(subcommand ? `Unknown facts command "${subcommand}"` : "Missing facts command");
  }

  let json = false;
  const positionals: string[] = [];
  const inputs: Record<string, string> = {};
  const runtimeOptions = createRuntimeArgs();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]!;

    if (arg === "--json") {
      json = true;
      continue;
    }

    const runtimeOptionIndex = readRuntimeOption(rest, index, runtimeOptions);
    if (runtimeOptionIndex !== undefined) {
      index = runtimeOptionIndex;
      continue;
    }

    if (arg === "--input") {
      const value = rest[index + 1];

      if (!value) {
        throw new Error("Missing value for --input");
      }

      readInputOverride(value, inputs);
      index += 1;
      continue;
    }

    if (arg.startsWith("--input=")) {
      readInputOverride(arg.slice("--input=".length), inputs);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}"`);
    }

    positionals.push(arg);
  }

  if (positionals[0] !== "host") {
    throw new Error("Missing facts target. Use: openstrap facts collect host");
  }

  if (positionals.length > 2) {
    throw new Error("Only one facts definition path can be provided");
  }

  return {
    command: "facts.collect",
    target: "host",
    configPath: positionals[1] ?? "examples/facts/system-inventory.yaml",
    json,
    inputs,
    ...runtimeOptions,
  };
}

function createRuntimeArgs(): RuntimeArgs {
  return {
    pluginSpecifiers: [],
  };
}

function readRuntimeOption(
  argv: readonly string[],
  index: number,
  runtimeOptions: RuntimeArgs,
): number | undefined {
  const arg = argv[index]!;

  if (arg === "--runtime-config") {
    const value = argv[index + 1];

    if (!value) {
      throw new Error("Missing value for --runtime-config");
    }

    runtimeOptions.runtimeConfigPath = value;
    return index + 1;
  }

  if (arg.startsWith("--runtime-config=")) {
    runtimeOptions.runtimeConfigPath = arg.slice("--runtime-config=".length);
    return index;
  }

  if (arg === "--plugin") {
    const value = argv[index + 1];

    if (!value) {
      throw new Error("Missing value for --plugin");
    }

    runtimeOptions.pluginSpecifiers.push(value);
    return index + 1;
  }

  if (arg.startsWith("--plugin=")) {
    runtimeOptions.pluginSpecifiers.push(arg.slice("--plugin=".length));
    return index;
  }

  if (arg === "--facts-backend") {
    const value = argv[index + 1];

    if (!value) {
      throw new Error("Missing value for --facts-backend");
    }

    runtimeOptions.factsBackendId = value;
    return index + 1;
  }

  if (arg.startsWith("--facts-backend=")) {
    runtimeOptions.factsBackendId = arg.slice("--facts-backend=".length);
    return index;
  }

  return undefined;
}

function readInputOverride(value: string, inputs: Record<string, string>): void {
  const separator = value.indexOf("=");

  if (separator <= 0) {
    throw new Error(`Invalid --input "${value}". Expected key=value`);
  }

  inputs[value.slice(0, separator)] = value.slice(separator + 1);
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

function renderFactsCollectOutput(output: StoredFactsDefinitionCollectResult): string {
  const item = output.facts[0]!;
  const data = item.snapshot.data as any;
  const lines: string[] = [];

  lines.push(`OpenStrap facts collect: ${item.run.status}`);
  lines.push(`Definition: ${output.definition.id} v${output.definition.version}`);
  lines.push(`Target: ${item.snapshot.target.id}`);
  lines.push(`Snapshot: ${item.snapshot.id} factRun=${item.run.id}`);
  lines.push(`Result file: ${output.storage.resultPath}`);
  lines.push("");
  lines.push(`Processes (${Object.keys(data.processes ?? {}).length}):`);
  for (const [id, processFact] of Object.entries<any>(data.processes ?? {})) {
    const processDetails = [
      processFact.pid !== undefined ? `pid=${processFact.pid}` : undefined,
      processFact.pids ? `pids=${processFact.pids.join(",")}` : undefined,
      processFact.user ? `user=${processFact.user}` : undefined,
      processFact.state ? `state=${processFact.state}` : undefined,
      processFact.command ? `command=${processFact.command}` : undefined,
    ].filter(Boolean).join(" ");

    lines.push(`  - ${id}: ${processFact.status}${processDetails ? ` ${processDetails}` : ""}`);
  }

  lines.push("");
  lines.push(`Services (${Object.keys(data.services ?? {}).length}):`);
  for (const [id, serviceFact] of Object.entries<any>(data.services ?? {})) {
    const serviceDetails = [
      serviceFact.manager ? `manager=${serviceFact.manager}` : undefined,
      serviceFact.running !== undefined ? `running=${serviceFact.running}` : undefined,
      serviceFact.pid !== undefined ? `pid=${serviceFact.pid}` : undefined,
      serviceFact.state ? `state=${serviceFact.state}` : undefined,
    ].filter(Boolean).join(" ");

    lines.push(`  - ${id}: ${serviceFact.status}${serviceDetails ? ` ${serviceDetails}` : ""}`);
  }

  lines.push("");
  lines.push("Files:");
  for (const [id, pathFact] of Object.entries<any>(data.paths ?? {})) {
    if (id === "home" || id === "workspace") {
      continue;
    }

    lines.push(`  - ${id}: ${pathFact.status} ${pathFact.path}${pathFact.type ? ` type=${pathFact.type}` : ""}`);
  }

  lines.push("");
  lines.push("Evidence:");
  for (const [id, command] of Object.entries(output.evidence.commands)) {
    const lineCount = command.stdout ? command.stdout.split("\n").filter(Boolean).length : 0;
    lines.push(`  - command ${id}: ${command.status}${lineCount > 0 ? ` lines=${lineCount}` : ""}`);
  }

  for (const [id, artifact] of Object.entries(output.evidence.artifacts)) {
    lines.push(`  - artifact ${id}: ${artifact.status} ${artifact.path}`);
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

  if (error instanceof OpenStrapPluginError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function usage(): string {
  return [
    "Usage:",
    "  openstrap run [configPath] [--json] [--runtime-config path] [--plugin specifier] [--facts-backend id]",
    "  openstrap facts collect host [factsPath] [--json] [--input key=value] [--runtime-config path] [--plugin specifier] [--facts-backend id]",
  ].join("\n");
}

export function isCliEntryPoint(importMetaUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(argvPath);
  } catch {
    return importMetaUrl === pathToFileURL(argvPath).href;
  }
}

if (isCliEntryPoint(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
