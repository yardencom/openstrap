import { CheckOutcome } from "./CheckOutcome.js";
import { Comparison } from "./Comparison.js";
import { factSections, Shape, type FactSection, type FactShape } from "#types/Facts.js";
import type { Observed, ObservedStatus } from "#types/Facts.js";
import type { CheckStatus, RequirementCheckNode, RequirementLeafCheck, RequirementResult, TargetlessRequirement } from "#types/Requirements.js";
import type { FactSnapshot } from "#types/FactSnapshot.js";

/** Fields that name the requirement rather than a section of facts. */
const meta = new Set(["id", "optional", "steps"]);

/** Statuses that mean the machine was not read, so nothing under them can be compared. */
const unreadable = new Set<ObservedStatus>(["unknown", "unsupported", "error"]);

/** One requirement, against one reading of one machine. */
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
        checks: RequirementCheck.unanswered(blocks, "No FactSnapshot was collected for requirement target"),
      };
    }

    const checks = Object.fromEntries(
      Object.entries(blocks).map(([section, expected]) => [section, this.node({
        expected,
        actual: (snapshot.facts as Record<string, unknown> | undefined)?.[section],
        path: [section],
        observed: undefined,
        shape: RequirementCheck.isFactSection(section) ? Shape.of(section) : undefined,
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
    if (!RequirementCheck.isRecord(at.expected) || Comparison.isAssertion(at.expected)) {
      return this.leaf(at);
    }

    const observed = RequirementCheck.asObserved(at.actual) ?? at.observed;
    const entries = RequirementCheck.namedEntriesOf(at.shape);
    const checks: Record<string, RequirementCheckNode> = this.presence(at, observed);

    for (const [key, expected] of Object.entries(at.expected)) {
      const actual = RequirementCheck.isRecord(at.actual) ? at.actual[key] : undefined;

      checks[key] = this.node({
        expected,
        // A name that is not in a map the machine filled in is not an unanswered question: the
        // machine listed what it found, and this is not among them. `tcp/6443` missing from
        // `network.ports` means nothing is listening there, which is an answer — and reporting it as
        // "missing from normalized facts" said instead that openstrap had failed to look.
        actual: actual === undefined && entries !== undefined && RequirementCheck.isRecord(at.actual)
          ? { status: "absent" }
          : actual,
        path: [...at.path, key],
        observed,
        shape: entries ?? RequirementCheck.fieldOf(at.shape, key),
      });
    }

    return checks;
  }

  /** A thing a requirement named has to be there. */
  private presence(
    at: { expected: unknown; actual: unknown; path: readonly string[]; shape: FactShape | undefined },
    observed: Observed | undefined,
  ): Record<string, RequirementCheckNode> {
    const named = at.path.length === 2 && RequirementCheck.namedEntriesOf(at.shape) === undefined;
    const asked = RequirementCheck.isRecord(at.expected) && ("status" in at.expected || "exists" in at.expected);

    if (!named || asked || observed === undefined || observed.status === "present") {
      return {};
    }

    return {
      status: RequirementCheck.checked(
        observed.status === "absent" ? "failed" : "error",
        "present",
        observed.status,
        `${at.path.join(".")} was required and is ${observed.status}`,
      ),
    };
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
        return RequirementCheck.checked("failed", at.expected, null, `${where} expected ${RequirementCheck.format(at.expected)}, got absent`);
      }

      return at.observed && unreadable.has(at.observed.status)
        ? RequirementCheck.checked("error", at.expected, null, `${where} cannot be verified: ${at.observed.status}`)
        : RequirementCheck.checked("error", at.expected, null, `${where} is missing from normalized facts`);
    }

    // The status itself stays comparable under an unreadable section: a requirement that asks
    // whether a service is `absent` is answered by the reading that said so.
    if (field !== "status" && at.observed && unreadable.has(at.observed.status)) {
      return RequirementCheck.checked("error", at.expected, at.actual, `${where} cannot be verified: ${at.observed.status}`);
    }

    const comparison = new Comparison(field, at.expected, at.actual).result();

    return RequirementCheck.checked(
      comparison.status,
      at.expected,
      at.actual,
      comparison.message ?? `${where} expected ${RequirementCheck.format(at.expected)}, got ${RequirementCheck.format(at.actual)}`,
    );
  }

  /** The same tree, with every leaf saying the same thing. */
  private static unanswered(expected: unknown, message: string): RequirementCheckNode {
    if (RequirementCheck.isRecord(expected) && !Comparison.isAssertion(expected)) {
      return Object.fromEntries(
        Object.entries(expected).map(([key, value]) => [key, RequirementCheck.unanswered(value, message)]),
      );
    }

    return RequirementCheck.checked("error", expected, null, message);
  }

  private static checked(status: CheckStatus, expected: unknown, actual: unknown, message: string): RequirementLeafCheck {
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

  private static namedEntriesOf(shape: FactShape | undefined): FactShape | undefined {
    return shape && typeof shape === "object" && "named" in shape ? shape.named : undefined;
  }

  private static fieldOf(shape: FactShape | undefined, key: string): FactShape | undefined {
    return shape && typeof shape === "object" && "fields" in shape ? shape.fields[key] : undefined;
  }

  private static asObserved(value: unknown): Observed | undefined {
    if (!RequirementCheck.isRecord(value) || typeof value.status !== "string") {
      return undefined;
    }

    return ["present", "absent", "unknown", "unsupported", "error"].includes(value.status)
      ? value as Observed
      : undefined;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  private static format(value: unknown): string {
    return JSON.stringify(value);
  }

  private static isFactSection(name: string): name is FactSection {
    return name in factSections;
  }
}



/** What one entry of a map looks like, when the model says this point holds named entries. */


/** What the machine said about a thing, when what it said has the shape of an answer. */



/** Whether this key of a requirement names a section a machine is read into. */
