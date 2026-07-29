import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PathFacts } from "./PathFacts.js";
import { Platform } from "../platform/Platform.js";

const facts = new PathFacts(Platform.current());

let root: string;
let file: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "openstrap-paths-"));
  file = join(root, "config.txt");
  writeFileSync(file, "PasswordAuthentication no\n");
  mkdirSync(join(root, "nested"));
  symlinkSync(join(root, "gone"), join(root, "dangling"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("paths", () => {
  it("answers under the name the caller gave, and says which path it looked at", () => {
    const answered = facts.paths({ settings: { path: file } });

    expect(answered.settings).toMatchObject({
      status: "present",
      path: file,
      exists: true,
      type: "file",
      readable: true,
    });
  });

  it("reports a path that is not there as an answer, not a failure", () => {
    expect(facts.paths({ missing: { path: join(root, "nope") } }).missing).toMatchObject({
      status: "absent",
      exists: false,
      reason: "path_not_found",
    });
  });

  it("reports a path that fails what the caller required as an error", () => {
    const answered = facts.paths({ settings: { path: file, require: ["directory"] } });

    expect(answered.settings).toMatchObject({
      status: "error",
      exists: true,
      type: "file",
      reason: "path_requirements_not_satisfied",
    });
  });

  it("accepts a path that satisfies everything required of it", () => {
    expect(facts.paths({ tree: { path: root, require: ["exists", "directory", "readable"] } }).tree.status).toBe("present");
  });

  it("keeps a broken symlink visible instead of calling it empty space", () => {
    expect(facts.paths({ link: { path: join(root, "dangling") } }).link).toMatchObject({
      status: "present",
      exists: true,
      type: "symlink",
    });
  });

  it("expands the home directory of the account doing the reading", () => {
    expect(facts.paths({ home: { path: "$HOME" } }).home.path).toBe(homedir());
    expect(facts.paths({ home: { path: "~" } }).home.path).toBe(homedir());
  });

  it("leaves a $HOME further along a path alone, because a file may be called that", () => {
    expect(facts.paths({ odd: { path: "/tmp/$HOME/x" } }).odd.path).toBe("/tmp/$HOME/x");
  });

  it("does not look at a path declared for another platform", () => {
    const other = Platform.current().is("linux") ? "macos" : "linux";

    expect(facts.paths({ elsewhere: { path: file, platforms: [other] } }).elsewhere).toMatchObject({
      status: "unsupported",
      reason: "platform_not_selected",
    });
  });
});

describe("artifacts", () => {
  it("keeps the shape of an artifact by default", () => {
    const answered = facts.artifacts({ settings: { path: file, kind: "config" } });

    expect(answered.settings).toMatchObject({ status: "present", kind: "config", type: "file" });
    expect(answered.settings.sizeBytes).toBeGreaterThan(0);
    expect(answered.settings.sha256).toBeUndefined();
    expect(answered.settings.content).toBeUndefined();
  });

  it("keeps a digest when asked to hash", () => {
    const answered = facts.artifacts({ settings: { path: file, capture: "hash" } });

    expect(answered.settings.sha256).toBe(createHash("sha256").update("PasswordAuthentication no\n").digest("hex"));
  });

  it("keeps the artifact itself when asked for its content", () => {
    expect(facts.artifacts({ settings: { path: file, capture: "content" } }).settings.content)
      .toBe("PasswordAuthentication no\n");
  });

  it("applies redaction to content it keeps", () => {
    const answered = facts.artifacts({
      settings: { path: file, capture: "content", redaction: { strategy: "mask", patterns: ["no"] } },
    });

    expect(answered.settings.content).toBe("PasswordAuthentication [masked]\n");
  });

  it("says why a directory cannot be hashed rather than pretending it was", () => {
    const answered = facts.artifacts({ tree: { path: root, capture: "hash" } });

    expect(answered.tree).toMatchObject({ status: "present", type: "directory", reason: "hash_requires_a_file" });
    expect(answered.tree.sha256).toBeUndefined();
  });

  it("reports a missing artifact as absent", () => {
    expect(facts.artifacts({ gone: { path: join(root, "nope") } }).gone).toMatchObject({
      status: "absent",
      reason: "artifact_path_not_found",
    });
  });
});
