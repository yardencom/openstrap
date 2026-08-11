import { orderedFactSections, Shape, type FactSection, type FactShape } from "#types/Facts.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

/** Fields of a requirement that name the requirement, not a fact section. */
const metaFields = new Set(["id", "optional"]);

/** Sections a reading can be told to go and find. */
const orderableSections = new Set<string>(orderedFactSections);

export type RequiredFactsRequest = {
  requirements: readonly TargetlessRequirement[];
};

/** What has to be read from a machine before its requirements can be checked. */
export class RequiredFacts {
  constructor(private readonly request: RequiredFactsRequest) {}

  get declaration(): Record<string, Record<string, unknown>> {
    /** Section, then name, then what that name was written with. */
    const order: Record<string, Record<string, unknown>> = {};

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

        // Names, wherever the model says a thing has one — and nothing else. A condition is not part
        // of an order: `cpu: { cores: { minimum: 2 } }` is answered by reading the processor, and how
        // much is enough is decided afterwards, by comparing.
        //
        // Which keys are names is asked of the shape rather than assumed from where they sit. They are
        // one level in for `services` and two for `network.ports`, and the reading needs them in both
        // cases: a port openstrap is to knock on has to have been named by somebody, because knocking
        // on every port a machine might have is a port scan.
        for (const [key, asked] of Object.entries(RequiredFacts.namesIn(Shape.of(section as FactSection), about))) {
          names[key] = asked;
        }
      }
    }

    return order;
  }

  /** The names a requirement mentions, in the shape the reading expects them. */
  private static namesIn(shape: FactShape | undefined, written: unknown): Record<string, unknown> {
    if (shape === undefined || typeof shape === "string" || written === null || typeof written !== "object") {
      return {};
    }

    if ("told" in shape) {
      return {};
    }

    if ("named" in shape) {
      return Object.fromEntries(Object.entries(written).map(([name, asked]) => [name, { ...asked }]));
    }

    if (shape.open) {
      return {};
    }

    const inside: Record<string, unknown> = {};

    for (const [field, asked] of Object.entries(written)) {
      const deeper = RequiredFacts.namesIn(shape.fields[field], asked);

      if (Object.keys(deeper).length > 0) {
        inside[field] = deeper;
      }
    }

    return inside;
  }
}
