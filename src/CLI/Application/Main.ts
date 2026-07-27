import {
  Blueprints,
} from "../../Blueprint/index.js";
import { Facts } from "../../Facts/Facts.js";
import { OpenStrapRun } from "../../OpenStrapRun/index.js";
import {
  createOpenStrapRuntime,
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  type OpenStrapRuntime,
} from "../../Plugin/index.js";
import {
  type RequirementCheckNode,
  type RequirementLeafCheck,
  type RequirementRun,
} from "../../Requirements/index.js";
import {
  collectAndStoreFactsFromDefinition,
  type StoredFactsCollectResult,
} from "./FactsCollectCommand.js";
import { createTarget } from "./CreateCommand.js";
import type { CreateMachineResult } from "../../Create/index.js";
import { CliArgsParser, type ParsedArgs, type RuntimeArgs } from "../Arguments/index.js";
import { CliErrors } from "./Errors.js";

export type OpenStrapRunOutput = {
  targets: Array<{
    name: string;
    scope: string;
    type: string;
    transport: string;
  }>;
  facts: Facts;
  requirementRun: RequirementRun;
};

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  cwd: string;
};

export async function runOpenStrapFlow(params: {
  configPath?: string;
  runtime: OpenStrapRuntime;
  workspaceRoot: string;
  now?: Date;
}): Promise<OpenStrapRunOutput> {
  const blueprint = new Blueprints().load({
    explicitPath: params.configPath,
    workspaceRoot: params.workspaceRoot,
  });

  const facts = await Facts.collect({
    blueprint,
    runtime: params.runtime,
    workspaceRoot: params.workspaceRoot,
    now: params.now,
  });
  const result = await new OpenStrapRun().execute({
    blueprint,
    facts,
    workspaceRoot: params.workspaceRoot,
    now: params.now,
  });

  return {
    targets: Object.values(blueprint.targets).map((target) => ({
      name: target.name,
      scope: target.scope,
      type: target.type,
      transport: target.transport,
    })),
    facts,
    requirementRun: result.requirementRun,
  };
}

export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  const argsParser = new CliArgsParser();
  const errors = new CliErrors();
  let parsedArgs: ParsedArgs;

  try {
    parsedArgs = argsParser.parse(argv);
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n\n${errors.usage()}\n`);
    return 2;
  }

  try {
    const runtime = await createCliRuntime(parsedArgs, io.cwd);

    if (parsedArgs.command === "facts.collect") {
      const output = await collectAndStoreFactsFromDefinition({
        backend: runtime.factsBackend,
        path: parsedArgs.configPath,
        workspaceRoot: io.cwd,
        inputs: parsedArgs.inputs,
      });

      io.stdout.write(parsedArgs.json
        ? `${JSON.stringify(output, null, 2)}\n`
        : renderFactsCollectOutput(output));

      return output.facts.some((item) => item.run.status === "error") ? 1 : 0;
    }

    if (parsedArgs.command === "create") {
      const created = await createTarget({
        target: parsedArgs.target,
        configPath: parsedArgs.configPath,
        hostPort: parsedArgs.hostPort,
        runtime,
        workspaceRoot: io.cwd,
      });

      io.stdout.write(parsedArgs.json
        ? `${JSON.stringify(created, null, 2)}\n`
        : renderCreateOutput(parsedArgs.target, created));

      return 0;
    }

    const output = await runOpenStrapFlow({
      configPath: parsedArgs.configPath,
      runtime,
      workspaceRoot: io.cwd,
    });

    io.stdout.write(parsedArgs.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : renderHumanOutput(output));

    return output.requirementRun.status === "passed" || output.requirementRun.status === "skipped" ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);
    return 2;
  }
}

async function createCliRuntime(args: RuntimeArgs, cwd: string) {
  const config = await loadOpenStrapPluginConfig({
    cwd,
    configPath: args.runtimeConfigPath,
  });
  const plugins = await Promise.all(args.pluginSpecifiers.map((specifier) => loadOpenStrapPlugin({
    cwd,
    specifier,
  })));

  return createOpenStrapRuntime({
    config,
    factsBackendId: args.factsBackendId,
    plugins,
  });
}

function renderCreateOutput(name: string, result: CreateMachineResult): string {
  const lines: string[] = [];

  lines.push(`OpenStrap create: ${result.created ? "created" : "already present"}`);
  lines.push("");
  lines.push("Steps:");

  for (const step of result.steps) {
    lines.push(`  - ${step.name}: ${step.status}${step.detail ? ` (${step.detail})` : ""}`);
  }

  lines.push("");
  lines.push("Image:");
  lines.push(`  ${result.image.reference} ${result.image.format}/${result.image.boot}`);
  lines.push(`  ${result.image.url}`);
  lines.push(`  sha256 ${result.image.sha256}`);
  lines.push("");
  lines.push(`Machine: ${name} (${result.handle.id})`);
  lines.push(`Access:  ssh ${result.endpoint.user}@${result.endpoint.host} -p ${result.endpoint.port}`);
  lines.push(`         openstrap connect ${name}`);
  lines.push("");

  return lines.join("\n");
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

function renderFactsCollectOutput(output: StoredFactsCollectResult): string {
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
  for (const [id, command] of Object.entries<any>(output.evidence.commands)) {
    const lineCount = command.stdout ? command.stdout.split("\n").filter(Boolean).length : 0;
    lines.push(`  - command ${id}: ${command.status}${lineCount > 0 ? ` lines=${lineCount}` : ""}`);
  }

  for (const [id, artifact] of Object.entries<any>(output.evidence.artifacts)) {
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
