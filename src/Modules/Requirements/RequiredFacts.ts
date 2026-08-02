import { namedFactSections, orderedFactSections } from "#types/Facts.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

/** Fields of a requirement that name the requirement, not a fact section. */
const metaFields = new Set(["id", "optional"]);

/**
 * Sections whose entries a caller has to name for the reading to find them.
 *
 * Taken from the model rather than written out again. This list was a copy, and a copy of it is how
 * a requirement about `runtimes.node` once lost the name it was about: the section was added to the
 * facts and not here, so `node` was read as a field instead of a name.
 */
const namedSections = new Set<string>(namedFactSections);

/**
 * Sections a reading can be told to go and find.
 *
 * A requirement may be written about `transports`, and nothing can be ordered about it: which
 * channel a machine was reached through is reported by whoever opened it. Asking for it in an order
 * is asking a machine a question it has no way to answer.
 */
const orderableSections = new Set<string>(orderedFactSections);

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

  /**
   * The order: one entry per section the requirements are about, holding the names they name.
   *
   * A section that no requirement mentions is not in it, and so is not collected. A section that
   * holds no names — how much memory there is, which architecture this is — is here with nothing in
   * it, because asking for it is all there is to say about it.
   */
  get declaration(): Record<string, Record<string, unknown>> {
    return Object.fromEntries(
      [...this.askedSections()].map(([section, names]) => [section, this.namedIn(section, names)]),
    );
  }

  /**
   * What the reading has to be told about one name.
   *
   * Usually nothing: a requirement names a thing, and how to find a thing by its name is the
   * business of whoever collects that section — `runtimes.docker` is a runtime called docker,
   * `paths./etc/ssh/sshd_config` is that path.
   *
   * The exception is a requirement that says where the thing is. `path` written as a plain string is
   * not a condition on what was found, it is where to look:
   *
   *     paths:
   *       workspace:
   *         path: /home/openstrap/app
   *         exists: true
   *
   * That is the only way to ask about a directory whose location is not its name, and it is what
   * makes such a requirement mean anything on a machine other than this one. Without it, `workspace`
   * falls back to the directory the run was started in — true here, and meaningless on a guest,
   * which has never heard of it.
   */
  private namedIn(section: string, names: ReadonlyMap<string, string | undefined>): Record<string, unknown> {
    return Object.fromEntries([...names].map(([name, where]) => [name, this.declared(section, name, where)]));
  }

  private declared(section: string, name: string, where: string | undefined): Record<string, unknown> {
    if (where !== undefined) {
      return { path: where };
    }

    return section === "paths" && name === "workspace"
      ? { path: this.request.workspaceRoot ?? "." }
      : {};
  }

  /**
   * Every section the requirements mention, the names asked about in it, and where a requirement
   * said to look for a name.
   *
   * Several requirements may ask about the same section, so the names are collected across all of
   * them: reading a section twice for two requirements could answer them differently about the same
   * machine. For the same reason two requirements cannot send one name to two places — that would be
   * one name meaning two things, and whichever won would make the other requirement judge a thing it
   * was not written about.
   */
  private askedSections(): Map<string, Map<string, string | undefined>> {
    const sections = new Map<string, Map<string, string | undefined>>();

    for (const requirement of this.request.requirements) {
      for (const [section, value] of Object.entries(requirement)) {
        if (metaFields.has(section) || !orderableSections.has(section)) {
          continue;
        }

        const names = sections.get(section) ?? new Map<string, string | undefined>();

        if (namedSections.has(section) && value !== null && typeof value === "object") {
          for (const [name, asked] of Object.entries(value as Record<string, unknown>)) {
            names.set(name, this.whereToLook(section, name, asked, names));
          }
        }

        sections.set(section, names);
      }
    }

    return sections;
  }

  /** Where a requirement said the thing is, when it said so, and the same place every time. */
  private whereToLook(
    section: string,
    name: string,
    asked: unknown,
    named: ReadonlyMap<string, string | undefined>,
  ): string | undefined {
    const stated = asked !== null && typeof asked === "object" && typeof (asked as { path?: unknown }).path === "string"
      ? (asked as { path: string }).path
      : undefined;
    const already = named.get(name);

    if (stated !== undefined && already !== undefined && already !== stated) {
      throw new Error(
        `Two requirements put "${name}" in ${section} in different places: "${already}" and "${stated}"`,
      );
    }

    return stated ?? already;
  }
}
