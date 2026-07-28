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
  RequiredFacts,
  type RequirementCheckNode,
  type RequirementLeafCheck,
  type RequirementRun,
} from "../../Requirements/index.js";
import {
  collectFactsFromDefinition,
  type FactsCollectResult,
} from "./FactsCollectCommand.js";
import { connectToTarget } from "./ConnectCommand.js";
import { createTarget } from "./CreateCommand.js";
import type { CreatedTarget } from "./CreateCommand.js";
import { CliArgsParser, type ParsedArgs, type RuntimeArgs } from "../Arguments/index.js";
import { CliErrors } from "./Errors.js";

type FactCollection = Awaited<ReturnType<Facts["collect"]>>["facts"];

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

export async function runOpenStrapFlow(params: {
  configPath?: string;
  workspaceRoot: string;
  now?: Date;
}): Promise<OpenStrapRunOutput> {
  const blueprint = new Blueprints().load({
    explicitPath: params.configPath,
    workspaceRoot: params.workspaceRoot,
  });
  // One instance per machine, because an instance is a way of reaching one. Every
  // target of a plain run is the machine openstrap is on, so every one of them is
  // read in process.
  const host = new Facts();
  const collected: FactCollection[number][] = [];

  for (const target of Object.values(blueprint.targets)) {
    collected.push(...(await host.collect({
      target: {
        name: target.name,
        scope: target.scope,
        type: target.type,
        displayName: target.displayName,
        transport: target.transport,
      },
      declare: new RequiredFacts({
        requirements: target.requirements,
        workspaceRoot: params.workspaceRoot,
      }).declaration,
      now: params.now,
    })).facts);
  }

  const result = await new OpenStrapRun().execute({
    blueprint,
    facts: collected,
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
    facts: collected,
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
    if (parsedArgs.command === "facts.collect") {
      const output = await collectFactsFromDefinition({
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
        runtime: await createCliRuntime(parsedArgs, io.cwd),
        workspaceRoot: io.cwd,
      });

      io.stdout.write(parsedArgs.json
        ? `${JSON.stringify(created, null, 2)}\n`
        : renderCreateOutput(parsedArgs.target, created));

      const status = created.requirementRun?.status;

      return status === undefined || status === "passed" || status === "skipped" ? 0 : 1;
    }

    if (parsedArgs.command === "connect") {
      const result = await connectToTarget({
        target: parsedArgs.target,
        command: parsedArgs.run,
        runtime: await createCliRuntime(parsedArgs, io.cwd),
      });

      io.stdout.write(result.output);

      return result.exitCode;
    }

    const output = await runOpenStrapFlow({
      configPath: parsedArgs.configPath,
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

async function createCliRuntime(args: RuntimeArgs, cwd: string): Promise<OpenStrapRuntime> {
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
    plugins,
  });
}

function renderCreateOutput(name: string, result: CreatedTarget): string {
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
  if (result.requirementRun) {
    lines.push("");
    lines.push(`Requirements: ${result.requirementRun.status}`);

    for (const requirement of result.requirementRun.results) {
      lines.push(`  - ${requirement.requirementId}: ${requirement.status}`);
    }
  }

  lines.push("");
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

function renderFactsCollectOutput(output: FactsCollectResult): string {
  const item = output.facts[0]!;
  const data = item.snapshot.data as Record<string, Record<string, Record<string, unknown>>>;
  const lines: string[] = [];

  lines.push(`OpenStrap facts collect: ${item.run.status}`);
  lines.push(`Definition: ${output.definition!.id} v${output.definition!.version}`);
  lines.push(`Target: ${item.snapshot.target.id}`);
  lines.push(`Snapshot: ${item.snapshot.id} factRun=${item.run.id}`);
  lines.push(`Result file: ${output.storage.resultPath}`);

  for (const section of ["processes", "services", "paths", "env", "commands", "artifacts"]) {
    const entries = Object.entries(data[section] ?? {}).filter(([id]) => !id.startsWith("pid-"));

    lines.push("");
    lines.push(`${section} (${entries.length}):`);

    for (const [id, fact] of entries) {
      lines.push(`  - ${id}: ${String(fact.status)}${describe(fact)}`);
    }
  }

  if (output.unread.length > 0) {
    lines.push("");
    lines.push(`Declared but not read: ${output.unread.join(", ")}`);
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
}

/** The fields of a fact worth putting on one line beside its status. */
function describe(fact: Record<string, unknown>): string {
  const shown = ["name", "path", "pid", "running", "state", "manager", "type", "version", "exitCode", "reason"]
    .filter((field) => fact[field] !== undefined)
    .map((field) => `${field}=${String(fact[field])}`);

  return shown.length === 0 ? "" : ` ${shown.join(" ")}`;
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
