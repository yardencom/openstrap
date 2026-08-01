import { describe, expect, it } from "vitest";

import { ToolFacts } from "./ToolFacts.js";
import { Platform } from "../platform/Platform.js";

const asking = (): ToolFacts => new ToolFacts(Platform.current());

describe("tools", () => {
  it("reports where a tool is and what version it says it is", async () => {
    const answered = await asking().tools({ node: {} });

    expect(answered.node).toMatchObject({ status: "present", name: "node", executable: true });
    expect(answered.node!.path).toContain("node");
    expect(answered.node!.version).toMatch(/^\d+\.\d+/);
  });

  it("reports a tool that does not resolve on PATH as absent", async () => {
    expect(await asking().tools({ missing: { name: "openstrap-no-such-tool" } })).toMatchObject({
      missing: { status: "absent", name: "openstrap-no-such-tool", executable: false },
    });
  });

  it("answers nothing when no tool was named, because it names none of its own", async () => {
    expect(await asking().tools({})).toEqual({});
  });

  it("answers under the caller's key rather than the tool's name", async () => {
    const answered = await asking().tools({ theRuntime: { name: "node" } });

    expect(answered.theRuntime).toMatchObject({ status: "present", name: "node" });
  });
});

describe("runtimes", () => {
  it("derives a runtime from the tool that provides it, so the two cannot disagree", async () => {
    const facts = asking();
    const tools = await facts.tools({ node: {} });
    const runtimes = await facts.runtimes({ node: {} });

    expect(runtimes.node).toMatchObject({ status: "present", type: "node", ready: true });
    expect(runtimes.node!.version).toBe(tools.node!.version);
  });

  it("looks the tools up once, however many sections turn out to need them", async () => {
    const facts = asking();
    const [tools, runtimes] = await Promise.all([facts.tools({ node: {} }), facts.runtimes({ node: {} })]);

    expect(Object.keys(runtimes).every((name) => name in tools)).toBe(true);
  });

  it("offers nothing when nobody asked for runtimes", async () => {
    expect(await new ToolFacts(Platform.current()).runtimes(undefined)).toEqual({});
  });

  it("offers no runtime for a tool that is not one", async () => {
    expect(await asking().runtimes({ git: {} })).toEqual({});
  });
});
