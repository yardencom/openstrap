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

  /**
   * A password does not go in a blueprint that lives in a repository.
   *
   * It does not go in an argument either: arguments are in the plan, in the process list of the
   * machine, and in the message a failed step prints. A step names the secret; the value is fetched
   * one moment before the program starts and exists only in what that program is given.
   */
  describe("a value a step named instead of writing", () => {
    it("reaches the program, and only the program", async () => {
      const applying = new Applying(async (name) => name === "the-key" ? "s3cr3t" : null);
      const applied = await applying.execute([{
        id: "check-it",
        requirements: ["a-requirement"],
        action: {
          kind: "run",
          command: "sh",
          // Nothing is echoed: the step passes if the program was given the value, and says nothing
          // about it either way.
          args: ["-c", 'test "$KEY" = s3cr3t'],
          environment: { KEY: { secret: "the-key" } },
        },
      }]);

      expect(applied).toEqual([{ stepId: "check-it", status: "done" }]);
    });

    it("still takes a value written out, because most of them are not secret", async () => {
      const applied = await new Applying().execute([{
        id: "check-it",
        requirements: ["a-requirement"],
        action: { kind: "run", command: "sh", args: ["-c", 'test "$WHERE" = /srv'], environment: { WHERE: "/srv" } },
      }]);

      expect(applied[0]!.status).toBe("done");
    });

    it("fails the step when nothing can answer, and names what it asked for", async () => {
      const applied = await new Applying().execute([{
        id: "needs-it",
        requirements: ["a-requirement"],
        action: { kind: "run", command: "true", args: [], environment: { KEY: { secret: "nowhere" } } },
      }]);

      // Not run with an empty variable. A program handed an empty password usually fails somewhere
      // less obvious, and a step that reported `done` would have made it worse.
      expect(applied[0]!.status).toBe("failed");
      expect(applied[0]!.message).toContain("nowhere");
    });

    it("keeps the value out of what it says when the step fails", async () => {
      const applying = new Applying(async () => "s3cr3t");
      const applied = await applying.execute([{
        id: "cannot",
        requirements: ["a-requirement"],
        action: {
          kind: "run",
          command: "sh",
          args: ["-c", "echo something went wrong 1>&2; exit 1"],
          environment: { KEY: { secret: "the-key" } },
        },
      }]);

      expect(applied[0]!.status).toBe("failed");
      expect(applied[0]!.message).toContain("something went wrong");
      expect(applied[0]!.message).not.toContain("s3cr3t");
    });
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
