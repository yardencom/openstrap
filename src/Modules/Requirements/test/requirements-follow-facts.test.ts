import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Blueprints } from "../../Blueprint/index.js";
import { fieldsOf } from "#types/Facts.js";

/**
 * A requirement is a condition over a fact, so what may be required follows from what is reported.
 *
 * It did not follow: the fields of each section were written out a second time, by hand, in the
 * requirement schema. Two lists of the same thing drift in whichever direction nobody is looking —
 * `pid` and `pids` are on every service reading and could not be required, and nothing anywhere
 * compared the two lists to notice.
 *
 * These tests are that comparison. They are written against `services`, the first section to be
 * derived rather than transcribed, and they hold in both directions: everything the facts report can
 * be required, and nothing they do not report can be.
 */
describe("what may be required of a service", () => {
  it("is every field the facts model says a service has", () => {
    for (const field of Object.keys(fieldsOf("services") ?? {})) {
      expect(accepts(`${field}: ${exampleFor(field)}`), field).toBe(true);
    }
  });

  it("includes the two the hand-written copy had lost", () => {
    expect(accepts("pid:\n              minimum: 1")).toBe(true);
    expect(accepts("pids:\n              contains: 1")).toBe(true);
  });

  it("is nothing else, however reasonable it sounds", () => {
    // A service has no `ready` — transports and runtimes do. Accepting it here would let a blueprint
    // require something no reading can answer, and the run would fail against a machine that is fine.
    expect(accepts("ready: true")).toBe(false);
    expect(accepts("healthy: true")).toBe(false);
  });

  it("says what a field holds, so the conditions fit it", () => {
    // A number is compared, a list is checked for membership, a string is matched.
    expect(accepts("pid:\n              minimum: 1")).toBe(true);
    expect(accepts("pid:\n              contains: 1")).toBe(false);
    expect(accepts("version:\n              pattern: '^1\\\\.'")).toBe(true);
    expect(accepts("running:\n              minimum: 1")).toBe(false);
  });
});

/** An example value of the right shape, so the field itself is what is under test. */
function exampleFor(field: string): string {
  const kind = fieldsOf("services")?.[field];

  switch (kind) {
    case "status":
      return "present";
    case "boolean":
      return "true";
    case "number":
      return "1";
    case "numbers":
      return "[1]";
    case "strings":
      return "[one]";
    default:
      return "something";
  }
}

/** Whether a blueprint carrying this condition about `services.k3s` loads at all. */
function accepts(condition: string): boolean {
  const directory = mkdtempSync(join(tmpdir(), "openstrap-requirement-"));

  writeFileSync(join(directory, "openstrap.yaml"), [
    "targets:",
    "  machine:",
    "    transport: local",
    "    requirements:",
    "      - id: about-a-service",
    "        services:",
    "          k3s:",
    `            ${condition}`,
  ].join("\n"));

  try {
    new Blueprints().load({ workspaceRoot: directory });

    return true;
  } catch {
    return false;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
