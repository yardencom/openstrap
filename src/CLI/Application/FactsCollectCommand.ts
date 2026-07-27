import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse } from "yaml";

import { JsonFileExporter } from "../../Export/index.js";
import { Facts } from "../../Facts/Facts.js";
import type { FactsBackend } from "../../Plugin/index.js";

type FactsDefinitionDocument = {
  id?: string;
  version?: number;
  description?: string;
  inputs?: Record<string, { default?: unknown }>;
  commands?: Array<Record<string, unknown>>;
  files?: Array<Record<string, unknown>>;
  processes?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
};

type CommandEvidence = Record<string, unknown>;
type ArtifactEvidence = Record<string, unknown>;

export type StoredFactsCollectResult = {
  definition: {
    id: string;
    version: number;
    description: string;
  };
  facts: Facts;
  evidence: {
    commands: Record<string, CommandEvidence>;
    artifacts: Record<string, ArtifactEvidence>;
  };
  storage: {
    runDirectory: string;
    resultPath: string;
  };
};

export async function collectAndStoreFactsFromDefinition(request: {
  backend: FactsBackend;
  path: string;
  workspaceRoot: string;
  inputs: Record<string, string>;
  now?: Date;
}): Promise<StoredFactsCollectResult> {
  const definition = readDefinition(request.path);
  const inputs = resolveDefinitionInputs(definition, request.inputs);
  const baseFacts = await Facts.collect({
    blueprint: {
      target: {
        name: "host",
        scope: "host",
        type: "machine",
        displayName: "Host",
        transport: "local",
        requirements: [{
          id: readString(definition.id, "facts-definition"),
          ...selectorsFromDefinition(definition),
        }],
      },
    },
    runtime: {
      factsBackend: request.backend,
    },
    workspaceRoot: request.workspaceRoot,
    now: request.now,
  });
  const baseItem = baseFacts[0];

  if (!baseItem) {
    throw new Error("Facts backend returned an empty collection");
  }

  const item = structuredClone(baseItem);
  const data = item.snapshot.data as Record<string, unknown>;
  const evidence = {
    commands: collectCommandEvidence(definition.commands ?? [], inputs, request.workspaceRoot),
    artifacts: collectArtifactEvidence(definition.artifacts ?? [], inputs, request.workspaceRoot),
  };

  data.paths = {
    ...(isRecord(data.paths) ? data.paths : {}),
    ...collectFileFacts(definition.files ?? [], inputs, request.workspaceRoot),
  };

  const facts = new Facts([{
    snapshot: item.snapshot,
    run: {
      ...item.run,
      status: hasEvidenceError(evidence) ? "warning" : "success",
    },
  }]);
  const result = {
    definition: {
      id: readString(definition.id, "facts-definition"),
      version: typeof definition.version === "number" ? definition.version : 1,
      description: readString(definition.description, ""),
    },
    facts,
    evidence,
  };

  return storeCollectedFacts({
    workspaceRoot: request.workspaceRoot,
    result,
  });
}

function readDefinition(path: string): FactsDefinitionDocument {
  const value = parse(readFileSync(path, "utf8"));

  return isRecord(value) ? value as FactsDefinitionDocument : {};
}

function selectorsFromDefinition(definition: FactsDefinitionDocument): Record<string, unknown> {
  const selectors: Record<string, unknown> = {};

  if (definition.processes !== undefined) {
    selectors.processes = Object.fromEntries(definition.processes.map((item) => [readString(item.id, ""), {
      name: typeof item.name === "string" ? item.name : undefined,
      command: typeof item.command === "string" ? item.command : undefined,
      redaction: isRecord(item.redaction) || typeof item.redaction === "string" ? item.redaction : undefined,
    }]));
  }

  if (definition.services !== undefined) {
    selectors.services = Object.fromEntries(definition.services.map((item) => [readString(item.id, ""), {
      name: typeof item.name === "string" ? item.name : undefined,
      manager: typeof item.manager === "string" ? item.manager : undefined,
    }]));
  }

  if (definition.files !== undefined) {
    selectors.paths = Object.fromEntries(definition.files.map((item) => [readString(item.id, ""), {}]));
  }

  return selectors;
}

function resolveDefinitionInputs(
  definition: FactsDefinitionDocument,
  overrides: Record<string, string>,
): Record<string, string> {
  const values = Object.fromEntries(Object.entries(definition.inputs ?? {}).flatMap(([key, input]) => {
    return input.default === undefined ? [] : [[key, String(input.default)]];
  }));

  return {
    ...values,
    ...overrides,
  };
}

function collectCommandEvidence(
  commands: readonly Record<string, unknown>[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, CommandEvidence> {
  return Object.fromEntries(commands.map((command) => {
    const id = readString(command.id, readString(command.name, "command"));
    const name = readString(command.name, "");
    const args = Array.isArray(command.args)
      ? command.args.map((arg) => interpolateDefinitionInput(String(arg), inputs))
      : [];

    if (!name) {
      return [id, {
        status: "error",
        reason: "command_name_missing",
      }];
    }

    try {
      const stdout = execFileSync(name, args, {
        cwd: workspaceRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: typeof command.timeoutMs === "number" ? command.timeoutMs : 5000,
        maxBuffer: typeof command.maxOutputBytes === "number" ? command.maxOutputBytes : 1024 * 1024,
      });

      return [id, {
        status: "success",
        command: name,
        args,
        stdout: applyRedaction(stdout, command.redaction),
      }];
    } catch (error) {
      return [id, {
        status: "error",
        command: name,
        args,
        exitCode: isRecord(error) && typeof error.status === "number" ? error.status : undefined,
        stderr: isRecord(error) && Buffer.isBuffer(error.stderr) ? applyRedaction(error.stderr.toString("utf8"), command.redaction) : undefined,
        reason: "command_failed",
      }];
    }
  }));
}

function collectArtifactEvidence(
  artifacts: readonly Record<string, unknown>[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, ArtifactEvidence> {
  return Object.fromEntries(artifacts.map((artifact) => {
    const id = readString(artifact.id, "artifact");
    const path = resolve(workspaceRoot, interpolateDefinitionInput(readString(artifact.path, ""), inputs));

    try {
      const stat = statSync(path);

      return [id, {
        status: "present",
        path,
        kind: artifact.kind,
        type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
        sizeBytes: stat.size,
      }];
    } catch {
      return [id, {
        status: "absent",
        path,
        kind: artifact.kind,
        reason: "artifact_path_not_found",
      }];
    }
  }));
}

function collectFileFacts(
  files: readonly Record<string, unknown>[],
  inputs: Record<string, string>,
  workspaceRoot: string,
): Record<string, unknown> {
  return Object.fromEntries(files.map((file) => {
    const id = readString(file.id, "file");
    const path = resolve(workspaceRoot, interpolateDefinitionInput(readString(file.path, ""), inputs));

    return [id, collectPathFact(path, Array.isArray(file.require) ? file.require.map(String) : [])];
  }));
}

function collectPathFact(path: string, requirements: readonly string[]): Record<string, unknown> {
  const base = {
    status: "absent",
    path,
    exists: false,
  };

  try {
    const stat = statSync(path);
    const fact = {
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

function storeCollectedFacts(request: {
  workspaceRoot: string;
  result: Omit<StoredFactsCollectResult, "storage">;
}): StoredFactsCollectResult {
  const item = request.result.facts[0];

  if (!item) {
    throw new Error("Collected facts result must contain at least one fact item");
  }

  const runDirectory = join(request.workspaceRoot, ".openstrap", "runs", "facts", item.run.id);
  const resultPath = join(runDirectory, "result.json");
  const storedResult = {
    ...request.result,
    storage: {
      runDirectory,
      resultPath,
    },
  };

  new JsonFileExporter().write({
    resultPath,
    payload: storedResult,
  });

  return storedResult;
}

function requirementsSatisfied(pathFact: Record<string, unknown>, requirements: readonly string[]): boolean {
  return requirements.every((requirement) => {
    if (requirement === "exists") return pathFact.exists === true;
    if (requirement === "absent") return pathFact.exists === false;
    if (requirement === "file") return pathFact.type === "file";
    if (requirement === "directory") return pathFact.type === "directory";
    if (requirement === "readable") return pathFact.readable === true;
    if (requirement === "writable") return pathFact.writable === true;
    if (requirement === "executable") return pathFact.executable === true;
    return true;
  });
}

function hasEvidenceError(evidence: {
  commands: Record<string, CommandEvidence>;
  artifacts: Record<string, ArtifactEvidence>;
}): boolean {
  return [...Object.values(evidence.commands), ...Object.values(evidence.artifacts)]
    .some((item) => item.status === "error");
}

function interpolateDefinitionInput(value: string, inputs: Record<string, string>): string {
  return value.replace(/\{\{\s*inputs\.([a-z][a-z0-9._-]*)\s*\}\}/g, (_, key: string) => inputs[key] ?? "");
}

function applyRedaction(output: string, redaction: unknown): string {
  if (!redaction || redaction === "none") {
    return output;
  }

  const strategy = typeof redaction === "string" ? redaction : isRecord(redaction) ? redaction.strategy : undefined;

  if (strategy === "omit") {
    return "";
  }

  if (strategy === "hash") {
    return createHash("sha256").update(output).digest("hex");
  }

  if (strategy === "mask") {
    if (!isRecord(redaction) || !Array.isArray(redaction.patterns) || redaction.patterns.length === 0) {
      return "[masked]";
    }

    return redaction.patterns.reduce((current, pattern) => {
      return current.replace(new RegExp(String(pattern), "g"), "[masked]");
    }, output);
  }

  return output;
}

function canAccess(path: string, mode: number): boolean {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
