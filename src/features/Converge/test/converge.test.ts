import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Converge } from "../Converge.js";
import type { Step } from "#types/Step.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

const host = { name: "host", scope: "host", type: "host" } as const;

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "openstrap-reach-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/**
 * Against this machine, and nothing pretending to be one.
 *
 * A convergence loop tested against a fake reader and a fake executor tests that two fakes agree.
 * What is required here is a file, what makes it true is a step that writes one, and the proof is
 * openstrap reading this machine again and saying the file is there.
 */
describe("bringing a machine to what was declared", () => {
  it("does the thing, reads the machine again, and answers with the reading", async () => {
    const file = join(directory, "wanted.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", file)],
      steps: [writes("write-the-file", file, ["the-file"])],
    });

    expect(result.end).toBe("satisfied");
    expect(result.passes).toHaveLength(1);
    expect(result.passes[0]!.applied).toEqual([{ stepId: "write-the-file", status: "done" }]);
    // The answer is a requirement run, judged against a reading taken after the step ran.
    expect(result.requirementRun.status).toBe("passed");
    expect(result.snapshot.facts.paths!.wanted!.exists).toBe(true);
    await expect(access(file)).resolves.toBeUndefined();
  });

  it("finds the order by reading again, rather than by being told it", async () => {
    // `copy` is written first and cannot work until `source` exists. Nothing declares that, no edge
    // is drawn, and no step is retried: pass one writes the source, pass two finds the machine
    // changed and the copy succeeds.
    const source = join(directory, "source.txt");
    const copy = join(directory, "copy.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-copy", copy), fileExists("the-source", source)],
      steps: [
        {
          id: "copy-the-file",
          requirements: ["the-copy"],
          action: { kind: "run", command: "cp", args: [source, copy] },
        },
        writes("write-the-source", source, ["the-source"]),
      ],
    });

    expect(result.passes.map((pass) => pass.applied.map((one) => one.status))).toEqual([
      ["failed", "done"],
      ["done"],
    ]);
    expect(result.end).toBe("satisfied");
    expect(result.requirementRun.status).toBe("passed");
  });

  it("plans no step twice, because a step is chosen by facts that are no longer false", async () => {
    const first = join(directory, "first.txt");
    const second = join(directory, "second.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-first", first), fileExists("the-second", second)],
      steps: [
        writes("write-the-first", first, ["the-first"]),
        { ...writes("write-the-second", second, ["the-second"]), action: failing() },
      ],
    });

    // Pass two plans only the step whose fact is still false. Nothing remembered that the other ran.
    expect(result.passes.map((pass) => pass.applied.map((one) => one.stepId))).toEqual([
      ["write-the-first", "write-the-second"],
      ["write-the-second"],
    ]);
  });

  it("works out the plan and changes nothing when only asked what it would do", async () => {
    const file = join(directory, "untouched.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", file)],
      steps: [writes("write-the-file", file, ["the-file"])],
      check: true,
    });

    expect(result.end).toBe("checked");
    expect(result.passes).toEqual([]);
    expect(result.plan.steps.map((step) => step.id)).toEqual(["write-the-file"]);
    await expect(access(file)).rejects.toThrow();
  });

  it("says so when nothing knows what to do, rather than reporting a run with no steps", async () => {
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", join(directory, "nobody-knows.txt"))],
    });

    expect(result.end).toBe("unresolved");
    expect(result.unresolved.map((one) => one.path)).toContain("paths.nobody-knows.exists");
    expect(result.requirementRun.status).toBe("failed");
  });

  it("stops when a pass moves nothing, instead of running the same steps to the bound", async () => {
    const file = join(directory, "never.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", file)],
      steps: [{ ...writes("cannot", file, ["the-file"]), action: failing() }],
      maxPasses: 5,
    });

    expect(result.end).toBe("stalled");
    expect(result.passes).toHaveLength(1);
  });

  it("stops at the bound with the machine read one last time", async () => {
    // Each pass does something — the file is written, and something else removes it — so nothing
    // stalls and nothing converges. This is the case the bound exists for.
    const file = join(directory, "tug-of-war.txt");
    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", file)],
      steps: [
        writes("write-it", file, ["the-file"]),
        {
          id: "take-it-away",
          requirements: ["the-file"],
          action: { kind: "remove", path: file },
        },
      ],
      maxPasses: 2,
    });

    expect(result.end).toBe("exhausted");
    expect(result.passes).toHaveLength(2);
    expect(result.requirementRun.status).toBe("failed");
  });

  it("leaves a step alone when its guard already holds", async () => {
    const wanted = join(directory, "wanted.txt");
    const guarded = join(directory, "guarded.txt");

    await new Converge().execute({
      target: host,
      requirements: [fileExists("the-guard", guarded)],
      steps: [writes("write-the-guard", guarded, ["the-guard"])],
    });

    const result = await new Converge().execute({
      target: host,
      requirements: [fileExists("the-file", wanted)],
      steps: [{
        ...writes("write-the-file", wanted, ["the-file"]),
        // Not about the file this step writes: a guard is for what the requirements do not describe.
        guard: { paths: { guarded: { path: guarded, exists: true } } },
      }],
      maxPasses: 1,
    });

    expect(result.end).toBe("unresolved");
    expect(result.passes).toEqual([]);
    await expect(access(wanted)).rejects.toThrow();
  });
});

function fileExists(id: string, path: string): TargetlessRequirement {
  return { id, paths: { [basename(path)]: { path, exists: true } } };
}

function writes(id: string, path: string, requirements: readonly string[]): Step {
  return {
    id,
    requirements,
    action: { kind: "write", path, content: "openstrap was here\n" },
  };
}

function failing(): Step["action"] {
  return { kind: "run", command: "sh", args: ["-c", "exit 1"] };
}

/** The name a path is known by in the facts: the file, without its directory or its extension. */
function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.txt$/, "");
}
