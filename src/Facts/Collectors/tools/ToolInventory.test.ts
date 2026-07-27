import { describe, expect, it } from "vitest";

import { LocalTransport } from "../../../Transport/index.js";
import type { Inventory } from "../Inventory.js";
import { OperatingSystem } from "../OperatingSystem.js";
import { Shell } from "../Shell.js";
import { ToolInventory, UnreadableToolNameError } from "./ToolInventory.js";

const shell = new Shell(new LocalTransport().processes);
const operatingSystem = await OperatingSystem.detect(shell);

const missing = "openstrap-no-such-tool";

describe("ToolInventory", () => {
  it("reports a tool that every unix machine has, and where it lives", async () => {
    const tools = await new ToolInventory(["sh"]).collect(shell, operatingSystem);

    expect(tools.sh).toMatchObject({ status: "present", type: "sh", executable: true, ready: true });
    expect(tools.sh.path).toMatch(/^\/.*\/sh$/);
  });

  it("reports a tool nobody has as absent rather than failing", async () => {
    const tools = await new ToolInventory([missing]).collect(shell, operatingSystem);

    expect(tools[missing]).toEqual({ status: "absent", type: missing, executable: false, ready: false });
  });

  it("answers about every tool it was asked about, keyed by that name", async () => {
    const asked = ["sh", missing, "git"];

    const tools = await new ToolInventory(asked).collect(shell, operatingSystem);

    expect(Object.keys(tools)).toEqual(asked);

    for (const name of asked) {
      expect(tools[name].type).toBe(name);
    }
  });

  it("extracts the version a tool reports about itself", async () => {
    const tools = await new ToolInventory(["node"]).collect(shell, operatingSystem);

    expect(tools.node.status).toBe("present");
    expect(tools.node.version).toMatch(/^\d+\.\d+/);
  });

  it("does not invent a path or a version for a tool that is not installed", async () => {
    const tools = await new ToolInventory([missing]).collect(shell, operatingSystem);

    expect(tools[missing].path).toBeUndefined();
    expect(tools[missing].version).toBeUndefined();
  });

  it("asks about node, npm, python3 and git when nobody says otherwise", async () => {
    const tools = await new ToolInventory().collect(shell, operatingSystem);

    expect(Object.keys(tools)).toEqual(["node", "npm", "python3", "git"]);

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.status).toBe(tool.executable ? "present" : "absent");
      expect(tool.ready).toBe(tool.executable);

      if (tool.executable) {
        expect(tool.path).toMatch(new RegExp(`/${name}$`));
      } else {
        expect(tool.path).toBeUndefined();
      }
    }
  });

  it("refuses a tool name the shell would read as more than one word", () => {
    expect(() => new ToolInventory(["git; rm -rf /"])).toThrow(UnreadableToolNameError);
  });

  it("is a tools inventory that a collector can hold like any other", async () => {
    const inventory: Inventory = new ToolInventory(["sh"]);

    expect(inventory.section).toBe("tools");
    await expect(inventory.collect(shell, operatingSystem)).resolves.toHaveProperty("sh");
  });
});
