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

    // The requirement as it was written. What a collector does not read it ignores: `running: true`
    // means nothing to whoever asks systemd about a service, and it does not have to be taken out
    // for that to be true.
    expect(declared.services).toEqual({ sshd: { running: true } });
    expect(declared.processes).toEqual({ sshd: { status: "present" } });
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

  it("knows no names of its own, not even workspace", () => {
    // `workspace` written without a path used to become the directory the run was started in. It was
    // the one word openstrap silently rewrote, and it meant something different on every machine it
    // was read on. A blueprint that means the directory it is run from writes `path: .`.
    const declared = new RequiredFacts({
      requirements: [{ id: "workspace-ready", paths: { workspace: { exists: true } } }],
    }).declaration;

    expect(declared.paths).toEqual({ workspace: { exists: true } });
  });

  it("carries the address a requirement wrote, which is the only way to look anywhere else", () => {
    const declared = new RequiredFacts({
      requirements: [{ id: "workspace", paths: { workspace: { path: "/home/openstrap", exists: true } } }],
    }).declaration;

    expect(declared.paths).toEqual({ workspace: { path: "/home/openstrap", exists: true } });
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
