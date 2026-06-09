import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";

import { SystemInformationFactCollector } from "../../Facts/Adapters/SystemInformationFactCollector.js";
import {
  createFactCollection,
  type FactCollectionRequest,
  type FactCollection,
  type FactCollectionItem,
  type HostSystem,
  type PathFact,
} from "../../Facts/index.js";
import {
  FactsDefinitionReader,
  FileRequirement,
  RedactionStrategy,
  type CommandFact,
  type FactsDefinition,
  type FileFact,
  type Redaction,
} from "../../FactsDefinition/index.js";
import type {
  FactCollectionTarget,
} from "../../Facts/index.js";

export type CommandEvidence = {
  status: "success" | "error" | "skipped";
  command: string;
  args: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  reason?: string;
};

export type ArtifactEvidence = {
  status: "present" | "absent" | "error";
  path: string;
  kind?: string;
  type?: string;
  sizeBytes?: number;
  reason?: string;
};

export type CollectFactsFromDefinitionResult = {
  definition: {
    id: string;
    version: number;
    description: string;
  };
  facts: FactCollection;
  evidence: {
    commands: Record<string, CommandEvidence>;
    artifacts: Record<string, ArtifactEvidence>;
  };
};

export type CollectFactsFromDefinitionRequest = {
  path: string;
  workspaceRoot: string;
  inputs?: Record<string, string>;
  now?: Date;
};

type FactsCollectionBackend = {
  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection>;
};

export class CollectFactsFromDefinition {
  constructor(
    private readonly definitionReader = new FactsDefinitionReader(),
    private readonly factsBackend: FactsCollectionBackend = new SystemInformationFactCollector(),
  ) {}

  async collect(request: CollectFactsFromDefinitionRequest): Promise<CollectFactsFromDefinitionResult> {
    const yamlText = readFileSync(request.path, "utf8");
    const definition = this.definitionReader.parseYaml(yamlText);
    const inputs = resolveInputs(definition, request.inputs ?? {});
    const baseItem = await this.collectBaseItem(definition, request, inputs);
    const data = baseItem.snapshot.data as HostSystem;
    const evidence = {
      commands: collectCommands(definition.commands ?? [], inputs, request.workspaceRoot),
      artifacts: collectArtifacts(definition, inputs, request.workspaceRoot),
    };

    data.paths = {
      ...data.paths,
      ...collectFiles(definition.files ?? [], inputs, request.workspaceRoot),
    };

    const runStatus = hasEvidenceError(evidence) ? "warning" : "success";
    const factCollection = createFactCollection([{
      snapshot: baseItem.snapshot,
      run: {
        ...baseItem.run,
        status: runStatus,
      },
    }]);

    return {
      definition: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
      },
      facts: factCollection,
      evidence,
    };
  }

  private collectBaseItem(
    definition: FactsDefinition,
    request: CollectFactsFromDefinitionRequest,
    inputs: Record<string, string>,
  ): Promise<FactCollectionItem> {
    return Promise.resolve(this.factsBackend.collect({
      targets: [{
        target: {
          name: "host",
          scope: "host",
          type: "machine",
          displayName: "Local host",
          transport: "local",
        } satisfies FactCollectionTarget,
        selectors: selectorsFromDefinition(definition),
      }],
      workspaceRoot: request.workspaceRoot,
      now: request.now,
    })).then((collection) => {
      const factCollection = createFactCollection(collection);
      const item = structuredClone(factCollection[0]!);
      const data = item.snapshot.data as HostSystem;

      data.paths = {
        ...data.paths,
        ...Object.fromEntries((definition.files ?? []).map((file) => [
          file.id,
          collectPathFact(resolve(request.workspaceRoot, interpolate(file.path, inputs)), file.require),
        ])),
      };

      return item;
    });
  }
}

function selectorsFromDefinition(definition: FactsDefinition): Record<string, unknown> {
  const selectors: Record<string, unknown> = {};

  if (definition.processes !== undefined) {
    selectors.processes = Object.fromEntries(definition.processes.map((item) => [item.id, {
      name: item.name,
      command: item.command,
      redaction: item.redaction,
    }]));
  }

  if (definition.services !== undefined) {
    selectors.services = Object.fromEntries(definition.services.map((item) => [item.id, {
      name: item.name,
      manager: item.manager,
    }]));
  }

  if (definition.files !== undefined) {
    selectors.paths = Object.fromEntries(definition.files.map((item) => [item.id, {}]));
  }

  return selectors;
}

function resolveInputs(definition: FactsDefinition, overrides: Record<string, string>): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, input] of Object.entries(definition.inputs ?? {})) {
    if (input.default !== undefined) {
      values[key] = String(input.default);
    }
  }

  return {
    ...values,
    ...overrides,
  };
}

function collectCommands(
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
  const args = (command.args ?? []).map((arg) => interpolate(arg, inputs));

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

function collectFiles(
  files: readonly FileFact[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, PathFact> {
  return Object.fromEntries(files.map((file) => [
    file.id,
    collectPathFact(resolve(workspaceRoot, interpolate(file.path, inputs)), file.require),
  ]));
}

function collectArtifacts(
  definition: FactsDefinition,
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, ArtifactEvidence> {
  return Object.fromEntries((definition.artifacts ?? []).map((artifact) => {
    const path = resolve(workspaceRoot, interpolate(artifact.path, inputs));

    try {
      const stat = statSync(path);

      return [artifact.id, {
        status: "present" as const,
        path,
        kind: artifact.kind,
        type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
        sizeBytes: stat.size,
      }];
    } catch {
      return [artifact.id, {
        status: "absent" as const,
        path,
        kind: artifact.kind,
        reason: "artifact_path_not_found",
      }];
    }
  }));
}

function collectPathFact(path: string, requirements: readonly FileRequirement[] | undefined): PathFact {
  const base: PathFact = {
    status: "absent",
    path,
    exists: false,
  };

  try {
    const stat = statSync(path);
    const fact: PathFact = {
      ...base,
      status: "present",
      exists: true,
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
      readable: canAccess(path, constants.R_OK),
      writable: canAccess(path, constants.W_OK),
      executable: canAccess(path, constants.X_OK),
      sizeBytes: stat.size,
    };

    return requirementsSatisfied(fact, requirements)
      ? fact
      : {
          ...fact,
          status: "error",
          reason: "file_requirements_not_satisfied",
        };
  } catch {
    return {
      ...base,
      reason: "path_not_found",
    };
  }
}

function requirementsSatisfied(path: PathFact, requirements: readonly FileRequirement[] | undefined): boolean {
  if (!requirements) {
    return true;
  }

  return requirements.every((requirement) => {
    if (requirement === FileRequirement.Exists) return path.exists === true;
    if (requirement === FileRequirement.Absent) return path.exists === false;
    if (requirement === FileRequirement.File) return path.type === "file";
    if (requirement === FileRequirement.Directory) return path.type === "directory";
    if (requirement === FileRequirement.Readable) return path.readable === true;
    if (requirement === FileRequirement.Writable) return path.writable === true;
    if (requirement === FileRequirement.Executable) return path.executable === true;
    return true;
  });
}

function interpolate(value: string, inputs: Record<string, string>): string {
  return value.replace(/\{\{\s*inputs\.([a-z][a-z0-9._-]*)\s*\}\}/g, (_, key: string) => inputs[key] ?? "");
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

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
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

function hasEvidenceError(evidence: CollectFactsFromDefinitionResult["evidence"]): boolean {
  return Object.values(evidence.commands).some((item) => item.status === "error") ||
    Object.values(evidence.artifacts).some((item) => item.status === "error");
}
