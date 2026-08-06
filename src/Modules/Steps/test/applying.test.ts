import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Applying } from "../apply/Applying.js";
import type { Action } from "#types/Action.js";
import type { Step } from "#types/Step.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "openstrap-applying-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("doing what the plan says", () => {
  it("runs a program, and where it was told to", async () => {
    const applied = await new Applying().execute([
      step("touch-it", { kind: "run", command: "touch", args: ["made-here"], cwd: directory }),
    ]);

    expect(applied).toEqual([{ stepId: "touch-it", status: "done" }]);
    expect((await stat(join(directory, "made-here"))).isFile()).toBe(true);
  });

  it("writes a file, makes the directory it sits in, and sets what it may be used for", async () => {
    const path = join(directory, "deep", "down", "script.sh");
    const applied = await new Applying().execute([
      step("write-it", { kind: "write", path, content: "#!/bin/sh\necho hello\n", access: "executable" }),
    ]);

    expect(applied[0]!.status).toBe("done");
    expect(await readFile(path, "utf8")).toContain("echo hello");
    expect((await stat(path)).mode & 0o777).toBe(0o755);
  });

  it("takes a file away, and says nothing when there was none", async () => {
    const path = join(directory, "gone.txt");

    await new Applying().execute([step("write-it", { kind: "write", path, content: "x" })]);

    const applied = await new Applying().execute([
      step("remove-it", { kind: "remove", path }),
      step("remove-it-again", { kind: "remove", path }),
    ]);

    expect(applied.map((one) => one.status)).toEqual(["done", "done"]);
  });

  it("reports a step that failed rather than throwing, and says what the machine said", async () => {
    const applied = await new Applying().execute([
      step("cannot", { kind: "run", command: "sh", args: ["-c", "echo nope 1>&2; exit 3"] }),
    ]);

    expect(applied[0]!.status).toBe("failed");
    expect(applied[0]!.message).toContain("nope");
  });

  it("carries on after a failure, because a step out of turn is the ordinary case", async () => {
    const applied = await new Applying().execute([
      step("first", { kind: "run", command: "false", args: [] }),
      step("second", { kind: "run", command: "touch", args: [join(directory, "still-ran")] }),
    ]);

    expect(applied.map((one) => one.status)).toEqual(["failed", "done"]);
    expect((await stat(join(directory, "still-ran"))).isFile()).toBe(true);
  });

  it("takes a channel of access from nobody, because it runs where the machine is", async () => {
    // Said here as a fact about the API and not only as a grep: there is nowhere to pass a
    // connection, so there cannot be a second way of doing this over one.
    const applied = await new Applying().execute([]);

    expect(applied).toEqual([]);
    expect(new Applying().execute.length).toBe(1);
  });
});

function step(id: string, action: Action): Step {
  return { id, requirements: ["a-requirement"], action };
}
