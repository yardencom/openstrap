import { platform } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FactsDefinitionCollector } from "../index.js";

describe("FactsDefinitionCollector", () => {
  it("stores process and service inventories as normalized facts", async () => {
    const result = await new FactsDefinitionCollector().collect({
      path: join(process.cwd(), "examples/facts/system-inventory.yaml"),
      workspaceRoot: process.cwd(),
      now: new Date("2026-06-09T00:00:00.000Z"),
    });
    const data = result.facts[0]!.snapshot.data as any;
    const processIds = Object.keys(data.processes);
    const serviceIds = Object.keys(data.services);
    const inventoryProcessId = processIds.find((id) => /^pid-\d+$/.test(id));

    expect(inventoryProcessId).toBeDefined();
    expect(data.processes[inventoryProcessId!]).toMatchObject({
      status: "present",
      pid: expect.any(Number),
      command: expect.any(String),
    });
    expect(data.processes["node-process"].status).toBe("present");
    expect(data.processes["node-process"].pids.length).toBeGreaterThan(0);

    if (platform() === "darwin") {
      expect(serviceIds.some((id) => id.startsWith("com.apple."))).toBe(true);
      expect(data.services[serviceIds.find((id) => id.startsWith("com.apple."))!]).toMatchObject({
        status: "present",
        manager: "launchd",
        name: expect.any(String),
      });
    }

    expect(serviceIds.length).toBeGreaterThan(0);
    expect(data.paths["tree-root"]).toMatchObject({
      status: "present",
      type: "directory",
    });
    expect(data.storage.mounts.workspace.path).toBe(process.cwd());
    expect(data.storage.filesystems).toBeUndefined();
    expect(result.evidence.commands).toEqual({});
    expect(result.evidence.artifacts["tree-root-metadata"]).toMatchObject({
      status: "present",
      kind: "directory-tree",
      type: "directory",
    });
  });
});
