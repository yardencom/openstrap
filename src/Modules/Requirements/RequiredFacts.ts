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
};

/**
 * What has to be read from a machine before its requirements can be checked.
 *
 * A requirement already says what it is about: its top-level fields are the sections, and in the
 * sections that hold named things, its keys are the names. So the order is the requirements read
 * once:
 *
 *     - id: docker-runtime            →  { runtimes: { docker: {} },
 *       runtimes: { docker: … }          →    cpu: {} }
 *       cpu: { cores: … }
 *
 * Deriving it rather than reading everything means a run pays only for the facts it is going to
 * compare — and, more importantly, that a requirement can never be checked against a section nobody
 * collected.
 *
 * The value is empty because a name is all a collector needs: how to find a runtime called `docker`
 * is the business of whoever collects runtimes. The exception is a requirement that says where the
 * thing is, which is the only way to ask about a directory whose location is not its name.
 */
export class RequiredFacts {
  constructor(private readonly request: RequiredFactsRequest) {}

  get declaration(): Record<string, Record<string, unknown>> {
    /** Section, then name, then what the reading has to be told about that name. */
    const order: Record<string, Record<string, Record<string, unknown>>> = {};

    for (const requirement of this.request.requirements) {
      for (const [section, about] of Object.entries(requirement)) {
        if (metaFields.has(section) || !orderableSections.has(section)) {
          continue;
        }

        // A section that holds no names is asked for and nothing more: asking is all there is to say
        // about how much memory a machine has. One that holds names collects them from every
        // requirement — reading a section twice could answer two requirements differently about the
        // same machine.
        const names = order[section] ?? {};
        order[section] = names;

        if (!namedSections.has(section) || about === null || typeof about !== "object") {
          continue;
        }

        for (const [name, asked] of Object.entries(about)) {
          names[name] = this.address(section, name, asked, names[name]);
        }
      }
    }

    return order;
  }

  /**
   * The address to put in the order for one name, when the order needs one.
   *
   * Usually it does not: `runtimes.docker` is a runtime called docker, and the collector needs no
   * more than that. A path is the exception, because a name like `config` is not a place, and a
   * requirement that states a `path` is saying where to go rather than what must be found there:
   *
   *     paths:
   *       workspace:
   *         path: /home/openstrap/app
   *         exists: true
   *
   * There are no names openstrap knows the meaning of. `workspace` used to be one: written without a
   * path it became the directory the run was started in, which is true on the machine that started
   * it and, on a guest, whatever directory openstrap was run in over there. A blueprint that means
   * the directory it is run from says so — `path: .` — and then the same words mean the same thing
   * wherever they are read.
   *
   * Two requirements sending one name to two places is refused rather than settled by whichever ran
   * last, because then some other requirement is judging a thing it was not written about.
   */
  private address(
    section: string,
    name: string,
    asked: unknown,
    already: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const stated = asked !== null && typeof asked === "object" && typeof (asked as { path?: unknown }).path === "string"
      ? (asked as { path: string }).path
      : undefined;
    const before = already?.path as string | undefined;

    if (stated !== undefined && before !== undefined && before !== stated) {
      throw new Error(`Two requirements put "${name}" in ${section} in different places: "${before}" and "${stated}"`);
    }

    const where = stated ?? before;

    return where === undefined ? {} : { path: where };
  }
}
