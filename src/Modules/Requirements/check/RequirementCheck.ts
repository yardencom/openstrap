import { CheckOutcome } from "./CheckOutcome.js";
import { Comparison } from "./Comparison.js";
import { factSections, shapeOf, type FactSection, type FactShape } from "#types/Facts.js";
import type { Observed, ObservedStatus } from "#types/Facts.js";
import type { CheckStatus, RequirementCheckNode, RequirementLeafCheck, RequirementResult, TargetlessRequirement } from "#types/Requirements.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";

/** Fields that name the requirement rather than a section of facts. */
const meta = new Set(["id", "optional"]);

/** Statuses that mean the machine was not read, so nothing under them can be compared. */
const unreadable = new Set<ObservedStatus>(["unknown", "unsupported", "error"]);

/**
 * One requirement, against one reading of one machine.
 *
 * A requirement is shaped like the facts it is about, so checking it is walking the two together:
 * every key of the requirement is a key of the facts, until a leaf is reached and there is something
 * to compare. What comes back has the same shape again — a tree of results — because a requirement
 * that failed somewhere deep is only useful if it says where.
 *
 * The walk carries two things that decide what a missing value means, and both exist because
 * "absent" and "unknown" are different answers and neither is "openstrap failed to look":
 *
 * - what the machine said about the section it is inside, so a field under a section that could not
 *   be read is reported as unverifiable rather than as a failure;
 * - what the model says sits at this point, so a name missing from a map the machine filled in is an
 *   absence — nothing is listening on that port — rather than a hole in the reading.
 */
export class RequirementCheck {
  constructor(private readonly requirement: TargetlessRequirement) {}

  against(snapshot: FactSnapshot | undefined, targetName: string): RequirementResult {
    const blocks = this.blocks();

    if (!snapshot) {
      return {
        requirementId: this.requirement.id,
        target: targetName,
        snapshotId: null,
        status: "error",
        checks: unanswered(blocks, "No FactSnapshot was collected for requirement target"),
      };
    }

    const checks = Object.fromEntries(
      Object.entries(blocks).map(([section, expected]) => [section, this.node({
        expected,
        actual: (snapshot.facts as Record<string, unknown> | undefined)?.[section],
        path: [section],
        observed: undefined,
        shape: isFactSection(section) ? shapeOf(section) : undefined,
      })]),
    );

    return {
      requirementId: this.requirement.id,
      target: targetName,
      snapshotId: String(snapshot.id),
      status: CheckOutcome.of(checks),
      checks,
    };
  }

  /** The sections this requirement is about: everything in it that is not its own name. */
  private blocks(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this.requirement).filter(([key]) => !meta.has(key)));
  }

  private node(at: {
    expected: unknown;
    actual: unknown;
    path: readonly string[];
    observed: Observed | undefined;
    shape: FactShape | undefined;
  }): RequirementCheckNode {
    if (!isRecord(at.expected) || Comparison.isAssertion(at.expected)) {
      return this.leaf(at);
    }

    const observed = asObserved(at.actual) ?? at.observed;
    const entries = namedEntriesOf(at.shape);
    const checks: Record<string, RequirementCheckNode> = {};

    for (const [key, expected] of Object.entries(at.expected)) {
      const actual = isRecord(at.actual) ? at.actual[key] : undefined;

      checks[key] = this.node({
        expected,
        // A name that is not in a map the machine filled in is not an unanswered question: the
        // machine listed what it found, and this is not among them. `tcp/6443` missing from
        // `network.ports` means nothing is listening there, which is an answer — and reporting it as
        // "missing from normalized facts" said instead that openstrap had failed to look.
        actual: actual === undefined && entries !== undefined && isRecord(at.actual)
          ? { status: "absent" }
          : actual,
        path: [...at.path, key],
        observed,
        shape: entries ?? fieldOf(at.shape, key),
      });
    }

    return checks;
  }

  private leaf(at: {
    expected: unknown;
    actual: unknown;
    path: readonly string[];
    observed: Observed | undefined;
  }): RequirementLeafCheck {
    const where = at.path.join(".");
    const field = at.path[at.path.length - 1] ?? "";

    if (at.actual === undefined) {
      if (at.observed?.status === "absent") {
        return checked("failed", at.expected, null, `${where} expected ${format(at.expected)}, got absent`);
      }

      return at.observed && unreadable.has(at.observed.status)
        ? checked("error", at.expected, null, `${where} cannot be verified: ${at.observed.status}`)
        : checked("error", at.expected, null, `${where} is missing from normalized facts`);
    }

    // The status itself stays comparable under an unreadable section: a requirement that asks
    // whether a service is `absent` is answered by the reading that said so.
    if (field !== "status" && at.observed && unreadable.has(at.observed.status)) {
      return checked("error", at.expected, at.actual, `${where} cannot be verified: ${at.observed.status}`);
    }

    const comparison = new Comparison(field, at.expected, at.actual).result();

    return checked(
      comparison.status,
      at.expected,
      at.actual,
      comparison.message ?? `${where} expected ${format(at.expected)}, got ${format(at.actual)}`,
    );
  }
}

/**
 * The same tree, with every leaf saying the same thing.
 *
 * A requirement checked against nothing still reports every check it holds, because a result that
 * listed no checks would read as a requirement that asked for nothing.
 */
function unanswered(expected: unknown, message: string): RequirementCheckNode {
  if (isRecord(expected) && !Comparison.isAssertion(expected)) {
    return Object.fromEntries(
      Object.entries(expected).map(([key, value]) => [key, unanswered(value, message)]),
    );
  }

  return checked("error", expected, null, message);
}

function checked(status: CheckStatus, expected: unknown, actual: unknown, message: string): RequirementLeafCheck {
  return {
    status,
    expected: {
      passed: status === "passed" ? true : status === "failed" ? false : null,
      value: expected,
    },
    actual,
    details: { message },
  };
}

/** What one entry of a map looks like, when the model says this point holds named entries. */
function namedEntriesOf(shape: FactShape | undefined): FactShape | undefined {
  return shape && typeof shape === "object" && "named" in shape ? shape.named : undefined;
}

function fieldOf(shape: FactShape | undefined, key: string): FactShape | undefined {
  return shape && typeof shape === "object" && "fields" in shape ? shape.fields[key] : undefined;
}

/** What the machine said about a thing, when what it said has the shape of an answer. */
function asObserved(value: unknown): Observed | undefined {
  if (!isRecord(value) || typeof value.status !== "string") {
    return undefined;
  }

  return ["present", "absent", "unknown", "unsupported", "error"].includes(value.status)
    ? value as Observed
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function format(value: unknown): string {
  return JSON.stringify(value);
}

/** Whether this key of a requirement names a section a machine is read into. */
function isFactSection(name: string): name is FactSection {
  return name in factSections;
}
