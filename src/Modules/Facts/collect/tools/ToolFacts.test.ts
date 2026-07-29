import { describe, expect, it } from "vitest";

import { ToolFacts } from "./ToolFacts.js";
import { Platform } from "../platform/Platform.js";

const facts = new ToolFacts(Platform.current());
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";

describe("tools", () => {
  it("reports where a tool is and what version it says it is", async () => {
    const answered = await facts.tools({ node: {} });

    expect(answered.node).toMatchObject({ status: "present", name: "node", executable: true });
    expect(answered.node!.path).toContain("node");
    expect(answered.node!.version).toMatch(/^\d+\.\d+/);
  });

  it("reports a tool that does not resolve on PATH as absent", async () => {
    expect(await facts.tools({ missing: { name: "openstrap-no-such-tool" } })).toMatchObject({
      missing: { status: "absent", name: "openstrap-no-such-tool", executable: false },
    });
  });

  it("reads the tools every blueprint asks about when nothing is declared", async () => {
    const answered = await facts.tools({});

    expect(Object.keys(answered)).toEqual(["node", "npm", "python3", "git"]);
  });

  it("answers under the caller's key rather than the tool's name", async () => {
    const answered = await facts.tools({ theRuntime: { name: "node" } });

    expect(answered.theRuntime).toMatchObject({ status: "present", name: "node" });
  });
});

describe("runtimes", () => {
  it("derives a runtime from the tool that provides it, so the two cannot disagree", async () => {
    const tools = await facts.tools({ node: {} });
    const runtimes = facts.runtimes(tools);

    expect(runtimes.node).toMatchObject({ status: "present", type: "node", ready: true });
    expect(runtimes.node!.version).toBe(tools.node!.version);
  });

  it("offers no runtime for a tool that is not one", async () => {
    expect(facts.runtimes(await facts.tools({ git: {} }))).toEqual({});
  });

  it("offers no runtime for a tool that is absent", () => {
    expect(facts.runtimes({ node: { status: "absent", name: "node", executable: false } })).toEqual({});
  });
});
