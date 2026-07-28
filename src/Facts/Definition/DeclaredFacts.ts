import { isAbsolute, resolve } from "node:path";

import type {
  ArtifactDeclaration,
  CommandDeclaration,
  EnvDeclaration,
  FactDeclaration,
  FactRedaction,
  PackageDeclaration,
  PathDeclaration,
  PathRequirement,
  ProcessDeclaration,
  ServiceDeclaration,
} from "../Domain/FactDeclaration.js";
import type { FactsDefinition } from "./Domain/Entities/FactsDefinition.js";
import { FactDeclarationSection } from "./Domain/ValueObjects/FactDeclarationSection.js";
import type { Redaction } from "./Domain/ValueObjects/Redaction.js";

/**
 * Sections a definition may declare that no reading answers.
 *
 * Named rather than ignored. A caller that wrote them down is entitled to be
 * told that openstrap did not look, because a definition that quietly collects
 * eight of its ten sections is worse than one that collects eight and says so.
 */
const unreadSections: readonly string[] = [
  FactDeclarationSection.Users,
  FactDeclarationSection.Groups,
  FactDeclarationSection.Sessions,
];

export type DeclaredFactsRequest = {
  definition: FactsDefinition;
  /** Values given on the command line, which win over the definition's defaults. */
  overrides?: Record<string, string>;
  /** What a relative path in the definition is relative to. */
  workspaceRoot: string;
};

/**
 * A facts definition read as an order for the facts module.
 *
 * The definition is a file format: sections are lists, ids live inside entries,
 * and paths are written relative to wherever the file was found. What the facts
 * module takes is none of those things — it takes named things and absolute
 * paths. Turning one into the other is this class's whole job, and it belongs
 * beside the format rather than inside the reading, because the reading runs on
 * machines that have never seen a YAML file.
 */
export class DeclaredFacts {
  private readonly inputs: Record<string, string>;

  constructor(private readonly request: DeclaredFactsRequest) {
    this.inputs = { ...defaultInputs(request.definition), ...request.overrides };
  }

  /** What to ask the machine about. */
  get declaration(): FactDeclaration {
    const definition = this.request.definition;

    return {
      processes: this.processes(),
      services: this.services(),
      paths: this.paths(),
      env: this.env(),
      commands: this.commands(),
      artifacts: this.artifacts(),
      packages: this.packages(),
      // Only what the definition actually mentions is read. A definition that
      // says nothing about processes should not pay for a process table.
      sections: Object.values(FactDeclarationSection)
        .filter((section) => definition[section as keyof FactsDefinition] !== undefined)
        .map((section) => (section === FactDeclarationSection.Files ? "paths" : section)),
    };
  }

  /** Sections the definition declares that this reading will not answer. */
  get unread(): readonly string[] {
    return unreadSections.filter((section) => this.request.definition[section as keyof FactsDefinition] !== undefined);
  }

  private processes(): Record<string, ProcessDeclaration> {
    return Object.fromEntries((this.request.definition.processes ?? []).map((process) => [process.id, {
      name: process.name,
      command: process.command,
      platforms: process.platforms,
      redaction: redactionOf(process.redaction),
    }]));
  }

  private services(): Record<string, ServiceDeclaration> {
    return Object.fromEntries((this.request.definition.services ?? []).map((service) => [service.id, {
      name: service.name,
      manager: service.manager,
      platforms: service.platforms,
    }]));
  }

  private paths(): Record<string, PathDeclaration> {
    return Object.fromEntries((this.request.definition.files ?? []).map((file) => [file.id, {
      path: this.absolute(file.path),
      require: file.require as readonly PathRequirement[] | undefined,
      platforms: file.platforms,
    }]));
  }

  private env(): Record<string, EnvDeclaration> {
    return Object.fromEntries((this.request.definition.env ?? []).map((variable) => [variable.id, {
      names: variable.names,
      platforms: variable.platforms,
      redaction: redactionOf(variable.redaction),
    }]));
  }

  private commands(): Record<string, CommandDeclaration> {
    return Object.fromEntries((this.request.definition.commands ?? []).map((command) => [command.id, {
      name: command.name,
      args: (command.args ?? []).map((argument) => this.interpolated(argument)),
      timeoutMs: command.timeoutMs,
      maxOutputBytes: command.maxOutputBytes,
      platforms: command.platforms,
      redaction: redactionOf(command.redaction),
    }]));
  }

  private artifacts(): Record<string, ArtifactDeclaration> {
    return Object.fromEntries((this.request.definition.artifacts ?? []).map((artifact) => [artifact.id, {
      path: this.absolute(artifact.path),
      kind: artifact.kind,
      capture: artifact.capture,
      platforms: artifact.platforms,
      redaction: redactionOf(artifact.redaction),
    }]));
  }

  private packages(): Record<string, PackageDeclaration> {
    return Object.fromEntries((this.request.definition.packages ?? []).map((entry) => [entry.id, {
      names: entry.names,
      manager: entry.manager,
      platforms: entry.platforms,
    }]));
  }

  /**
   * A path the machine being read can act on.
   *
   * Relative paths in a definition are relative to the workspace the definition
   * was found in, which only the host knows about. A `$HOME` or `~` prefix is
   * left alone: that one is expanded by whoever reads the machine, because the
   * home directory that matters is the one on that machine.
   */
  private absolute(path: string): string {
    const interpolated = this.interpolated(path);

    if (interpolated.startsWith("$HOME") || interpolated.startsWith("~") || isAbsolute(interpolated)) {
      return interpolated;
    }

    return resolve(this.request.workspaceRoot, interpolated);
  }

  private interpolated(value: string): string {
    return value.replace(
      /\{\{\s*inputs\.([a-z][a-z0-9._-]*)\s*\}\}/g,
      (_, key: string) => this.inputs[key] ?? "",
    );
  }
}

/** What the definition itself says an input should be when nobody says otherwise. */
function defaultInputs(definition: FactsDefinition): Record<string, string> {
  return Object.fromEntries(
    Object.entries(definition.inputs ?? {})
      .filter(([, input]) => input.default !== undefined)
      .map(([key, input]) => [key, String(input.default)]),
  );
}

/**
 * Redaction as the reading understands it.
 *
 * The file format allows a bare strategy name as shorthand for an object with
 * nothing else in it, which is convenient to write and awkward to act on. The
 * shorthand is expanded here so that everything downstream sees one shape.
 */
function redactionOf(declared: Redaction | undefined): FactRedaction | undefined {
  if (declared === undefined) {
    return undefined;
  }

  return typeof declared === "string"
    ? { strategy: declared }
    : { strategy: declared.strategy, patterns: declared.patterns };
}
