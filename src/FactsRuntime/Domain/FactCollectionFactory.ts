import type { FactCollection, FactCollectionItem } from "./Facts.js";

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
