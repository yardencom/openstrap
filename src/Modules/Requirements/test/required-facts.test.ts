import { describe, expect, it } from "vitest";

import { RequiredFacts } from "../RequiredFacts.js";

describe("RequiredFacts", () => {
  it("asks only about the sections the requirements mention", () => {
    const declared = new RequiredFacts({
      requirements: [
        { id: "resources", cpu: { cores: { minimum: 1 } }, memory: { totalBytes: { minimum: 1 } } },
      ],
    }).declaration;

    // One entry per section, holding the names asked about in it — none, for these two.
    expect(declared).toEqual({ cpu: {}, memory: {} });
  });

  it("does not mistake the fields naming a requirement for fact sections", () => {
    const declared = new RequiredFacts({
      requirements: [{ id: "optional-check", optional: true, arch: { const: "arm64" } }],
    }).declaration;

    expect(declared).toEqual({ arch: {} });
  });

  it("carries the names asked about in a section into the declaration", () => {
    const declared = new RequiredFacts({
      requirements: [
        { id: "ssh", services: { sshd: { running: true } }, processes: { sshd: { status: "present" } } },
      ],
    }).declaration;

    // The name and nothing else. How to find a service called `sshd` is the service collector's
    // business, and it already has the name.
    expect(declared.services).toEqual({ sshd: {} });
    expect(declared.processes).toEqual({ sshd: {} });
  });

  it("collects the names across every requirement that asks about a section", () => {
    const declared = new RequiredFacts({
      requirements: [
        { id: "ssh", services: { sshd: { running: true } } },
        { id: "cron", services: { cron: { running: true } } },
      ],
    }).declaration;

    expect(Object.keys(declared.services!)).toEqual(["sshd", "cron"]);
    expect(Object.keys(declared)).toEqual(["services"]);
  });

  it("knows where the workspace is, because only the run does", () => {
    const declared = new RequiredFacts({
      requirements: [{ id: "workspace-ready", paths: { workspace: { exists: true } } }],
      workspaceRoot: "/workspace/app",
    }).declaration;

    expect(declared.paths).toEqual({ workspace: { path: "/workspace/app" } });
  });

  it("says nothing about where a path is, because the machine knows", () => {
    const declared = new RequiredFacts({
      requirements: [
        { id: "home-ready", paths: { home: { writable: true } } },
        { id: "ssh-config", paths: { "/etc/ssh/sshd_config": { exists: true } } },
      ],
    }).declaration;

    expect(declared.paths).toEqual({ home: {}, "/etc/ssh/sshd_config": {} });
  });

  it("names a section that holds no named things without naming anything in it", () => {
    const declared = new RequiredFacts({
      requirements: [{ id: "on-arm", arch: { const: "arm64" } }],
    }).declaration;

    expect(declared).toEqual({ arch: {} });
  });

  it("orders nothing for a section no reading can be told to find", () => {
    // A requirement about the channel is legitimate — it is how a blueprint says "reached by key and
    // nothing else". But nothing on a machine can answer which channel someone arrived through, so
    // there is nothing to ask it for: the answer comes from whoever opened it.
    const declared = new RequiredFacts({
      requirements: [{ id: "transport", transports: { ssh: { ready: true } } }],
    }).declaration;

    expect(declared).toEqual({});
  });

  it("asks for nothing when there is nothing to check", () => {
    const declared = new RequiredFacts({ requirements: [] }).declaration;

    expect(declared).toEqual({});
  });
});
