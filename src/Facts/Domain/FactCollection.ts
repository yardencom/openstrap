import type { FactRun, FactSnapshot } from "./FactSnapshot.js";

export type FactCollectionItem = {
  snapshot: FactSnapshot<unknown>;
  run: FactRun;
};

/** Everything one collection run found, one item per machine read. */
export type FactCollection = readonly FactCollectionItem[];

/**
 * Keys a snapshot may never carry.
 *
 * A snapshot says what a machine is. Why it was read, how confident anyone is
 * about it and where it came from are properties of the run that read it, and
 * letting them into the snapshot is how a snapshot stops being comparable to
 * the next one.
 */
const forbiddenSnapshotKeys = new Set([
  "profile",
  "purpose",
  "provenance",
  "metadata",
  "sources",
  "confidence",
]);

export class FactCollectionValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid fact collection: ${issues.join("; ")}`);
    this.name = "FactCollectionValidationError";
    this.issues = issues;
  }
}

/**
 * The only way to get a fact collection.
 *
 * Every rule that has to hold of a collection is checked here and the result is
 * frozen, so a collection cannot exist in an invalid state and cannot be edited
 * into one afterwards. Anything downstream — a requirement check, a stored
 * snapshot, a printed report — can then read it without re-validating.
 */
export function createFactCollection(items: readonly FactCollectionItem[]): FactCollection {
  const issues: string[] = [];

  if (items.length === 0) {
    issues.push("FactCollection must contain at least one snapshot");
  }

  items.forEach((item, index) => {
    const prefix = `items.${index}`;

    if (item.run.snapshotId !== item.snapshot.id) {
      issues.push(`${prefix}.run.snapshotId must match ${prefix}.snapshot.id`);
    }

    for (const key of forbiddenSnapshotKeys) {
      if (hasOwn(item.snapshot, key)) {
        issues.push(`${prefix}.snapshot must not contain ${key}`);
      }
    }

    // An error belongs to the section that failed, so that the sections which
    // answered stay usable. A top-level bag of errors loses that.
    if (isRecord(item.snapshot.data) && hasOwn(item.snapshot.data, "errors")) {
      issues.push(`${prefix}.snapshot.data must not contain top-level errors`);
    }
  });

  if (issues.length > 0) {
    throw new FactCollectionValidationError(issues);
  }

  return deepFreeze(items.map((item) => ({
    snapshot: item.snapshot,
    run: item.run,
  })));
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const property of Object.values(value)) {
    deepFreeze(property);
  }

  return value;
}
