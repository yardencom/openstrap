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
 *     - id: docker-runtime          →  { runtimes: { docker: { ready: true } },
 *       runtimes:                        cpu: {} }
 *         docker: { ready: true }
 *       cpu: { cores: { minimum: 2 } }
 *
 * Deriving it rather than reading everything means a run pays only for the facts it is going to
 * compare — and, more importantly, that a requirement can never be checked against a section nobody
 * collected.
 *
 * What each name carries is what the requirements wrote about it, unedited. A collector reads the
 * few fields it is told — a path to look at, a service to look for — and ignores the rest: `ready:
 * true` means nothing to whoever asks about a runtime, and it does not have to be taken out for that
 * to be true.
 */
export class RequiredFacts {
  constructor(private readonly request: RequiredFactsRequest) {}

  get declaration(): Record<string, Record<string, unknown>> {
    /** Section, then name, then what that name was written with. */
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
          names[name] = merged(section, name, names[name], asked);
        }
      }
    }

    return order;
  }
}

/**
 * One name, as every requirement that mentions it wrote it.
 *
 * The order is the requirements themselves rather than a stripped copy of them. It used to be
 * stripped — names only — and then the one thing a collector actually reads from a requirement, the
 * path, had to be put back by a method that knew which sections have addresses. What a collector
 * does not read it ignores: `exists: true` means nothing to whoever opens a file, and it does not
 * have to be taken out for that to be true.
 *
 * Two requirements that write the same field differently are refused rather than settled by
 * whichever ran last: one name looked for in two places would leave one of them judging a thing it
 * was not written about.
 */
function merged(
  section: string,
  name: string,
  already: Record<string, unknown> | undefined,
  asked: unknown,
): Record<string, unknown> {
  if (asked === null || typeof asked !== "object") {
    return already ?? {};
  }

  const written = { ...already };

  for (const [field, value] of Object.entries(asked)) {
    const before = written[field];

    if (before !== undefined && JSON.stringify(before) !== JSON.stringify(value)) {
      throw new Error(
        `Two requirements write ${section}.${name}.${field} differently: ` +
        `${JSON.stringify(before)} and ${JSON.stringify(value)}`,
      );
    }

    written[field] = value;
  }

  return written;
}
