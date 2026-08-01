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
   * What the reading has to be told about one name: the name, and nothing else.
   *
   * A requirement can only name things — `runtimes.docker`, `paths./etc/ssh/sshd_config`, `env.HOME` —
   * and how to go and find a thing by its name is knowledge that belongs to whoever collects that
   * section. This used to decide it here, per section: a path by `path`, a variable by `names`,
   * everything else by `name`. All three were the key written out again in a different field, and
   * the one section that was forgotten reached its collector without the field it reads.
   *
   * `workspace` is the exception, and it is not a section rule but one name: it means the directory
   * the run was started in, which the machine being read cannot know — a guest has never heard of
   * it. So it is the caller that answers, here.
   */
  private namedIn(section: string, names: ReadonlySet<string>): Record<string, unknown> {
    return Object.fromEntries([...names].map((name) => [
      name,
      section === "paths" && name === "workspace" ? { path: this.request.workspaceRoot ?? "." } : {},
    ]));
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
        if (metaFields.has(section) || !orderableSections.has(section)) {
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
}
