import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CommandFacts } from "./CommandFacts.js";
import { Platform } from "../platform/Platform.js";

const facts = new CommandFacts(Platform.current());
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";

describe("declared commands", () => {
  it("reports what the command printed", async () => {
    const answered = await facts.commands({
      greeting: { name: process.execPath, args: ["-e", "process.stdout.write('hello')"] },
    });

    expect(answered.greeting).toMatchObject({ status: "present", exitCode: 0, stdout: "hello" });
  });

  it("reports a command that would not run as an error, not an absence", async () => {
    const answered = await facts.commands({
      broken: { name: process.execPath, args: ["-e", "process.stderr.write('nope'); process.exit(3)"] },
    });

    expect(answered.broken).toMatchObject({ status: "error", exitCode: 3, reason: "command_failed" });
    expect(answered.broken.stderr).toContain("nope");
  });

  it("reports a command that does not exist as an error", async () => {
    const answered = await facts.commands({ absent: { name: "openstrap-no-such-program" } });

    expect(answered.absent).toMatchObject({ status: "error", reason: "command_failed" });
  });

  it("does not run a command declared for another platform", async () => {
    const answered = await facts.commands({
      elsewhere: { name: process.execPath, args: ["-e", "process.stdout.write('ran')"], platforms: [otherPlatform] },
    });

    expect(answered.elsewhere).toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
    expect(answered.elsewhere.stdout).toBeUndefined();
  });

  it("applies redaction before the output is recorded", async () => {
    const answered = await facts.commands({
      secret: {
        name: process.execPath,
        args: ["-e", "process.stdout.write('token=abc')"],
        redaction: { strategy: "hash" },
      },
    });

    expect(answered.secret.stdout).toBe(createHash("sha256").update("token=abc").digest("hex"));
  });

  it("keeps output within the limit the caller set", async () => {
    const answered = await facts.commands({
      long: { name: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(100))"], maxOutputBytes: 10 },
    });

    expect(answered.long.stdout).toHaveLength(10);
  });

  it("records the arguments it was asked to run with", async () => {
    const answered = await facts.commands({
      version: { name: process.execPath, args: ["--version"] },
    });

    expect(answered.version.args).toEqual(["--version"]);
    expect(answered.version.name).toBe(process.execPath);
  });
});

describe("declared environment variables", () => {
  it("answers with the first spelling this machine sets", () => {
    const answered = facts.env({ searchPath: { names: ["OPENSTRAP_NOT_SET", "PATH"] } });

    expect(answered.searchPath).toMatchObject({ status: "present", name: "PATH", redacted: false });
    expect(answered.searchPath.value).toBe(process.env.PATH);
  });

  it("reports a variable nothing sets as absent", () => {
    expect(facts.env({ nothing: { names: ["OPENSTRAP_DEFINITELY_NOT_SET"] } }).nothing).toMatchObject({
      status: "absent",
      name: "OPENSTRAP_DEFINITELY_NOT_SET",
    });
  });

  it("withholds a value it was told to redact, and says that it did", () => {
    const answered = facts.env({ searchPath: { names: ["PATH"], redaction: { strategy: "omit" } } });

    expect(answered.searchPath).toMatchObject({ status: "present", value: "", redacted: true });
  });

  it("does not read a variable declared for another platform", () => {
    expect(facts.env({ elsewhere: { names: ["PATH"], platforms: [otherPlatform] } }).elsewhere).toMatchObject({
      status: "unsupported",
      reason: "platform_not_selected",
    });
  });

  it("reads nothing that was not named", () => {
    expect(facts.env({})).toEqual({});
  });
});
