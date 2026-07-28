import type { TargetlessRequirement } from "../Domain/Requirements.js";

/** Fields of a requirement that name the requirement, not a fact section. */
const metaFields = new Set(["id", "optional"]);

/** Sections whose entries a caller has to name for the reading to find them. */
const namedSections = new Set(["processes", "services", "tools", "paths", "env", "commands", "artifacts", "packages", "users", "groups"]);

export type RequiredFactsRequest = {
  requirements: readonly TargetlessRequirement[];
  /** Where the run is happening, for a requirement written about the workspace. */
  workspaceRoot?: string;
};

/**
 * What has to be read from a machine before its requirements can be checked.
 *
 * A requirement already says what it is about: its top-level fields are fact
 * sections and, in the sections that hold named things, its keys are the names.
 * Deriving the reading from the requirements rather than reading everything means
 * a run pays only for the facts it is going to compare — and, more importantly,
 * that a requirement can never be checked against a section nobody collected.
 *
 * This lives with requirements rather than with facts because it is requirements
 * that know their own shape. The facts module has never heard of a blueprint.
 */
export class RequiredFacts {
  constructor(private readonly request: RequiredFactsRequest) {}

  get declaration(): {
    sections: string[];
    processes: Record<string, { name: string }>;
    services: Record<string, { name: string }>;
    tools: Record<string, { name: string }>;
    users: Record<string, { name: string }>;
    groups: Record<string, { name: string }>;
    paths: Record<string, { path: string }>;
  } {
    const asked = this.askedSections();

    return {
      sections: [...asked.keys()],
      processes: named(asked.get("processes"), (name) => ({ name })),
      services: named(asked.get("services"), (name) => ({ name })),
      tools: named(asked.get("tools"), (name) => ({ name })),
      users: named(asked.get("users"), (name) => ({ name })),
      groups: named(asked.get("groups"), (name) => ({ name })),
      paths: named(asked.get("paths"), (name) => ({ path: this.pathOf(name) })),
    };
  }

  /**
   * Every section the requirements mention, and the names asked about in it.
   *
   * Several requirements may ask about the same section, so the names are
   * collected across all of them: reading a section twice for two requirements
   * could answer them differently about the same machine.
   */
  private askedSections(): Map<string, Set<string>> {
    const sections = new Map<string, Set<string>>();

    for (const requirement of this.request.requirements) {
      for (const [section, value] of Object.entries(requirement)) {
        if (metaFields.has(section)) {
          continue;
        }

        const names = sections.get(section) ?? new Set<string>();

        if (namedSections.has(section) && value !== null && typeof value === "object") {
          for (const name of Object.keys(value)) {
            names.add(name);
          }
        }

        sections.set(section, names);
      }
    }

    return sections;
  }

  /**
   * Which path a requirement about `paths` is actually about.
   *
   * `workspace` and `home` are the two a blueprint can rely on without spelling
   * them out, because openstrap knows where they are. Any other name is taken as
   * the path itself, which is what a requirement written about `/etc/ssh` means.
   */
  private pathOf(name: string): string {
    if (name === "workspace") {
      return this.request.workspaceRoot ?? ".";
    }

    return name === "home" ? "$HOME" : name;
  }
}

function named<TDeclaration>(
  names: Set<string> | undefined,
  declare: (name: string) => TDeclaration,
): Record<string, TDeclaration> {
  return Object.fromEntries([...(names ?? [])].map((name) => [name, declare(name)]));
}
