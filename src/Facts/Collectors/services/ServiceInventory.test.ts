import { beforeAll, describe, expect, it } from "vitest";

import { LocalTransport } from "../../../Transport/index.js";
import { OperatingSystem } from "../OperatingSystem.js";
import { Shell } from "../Shell.js";
import type { ServiceFact } from "../Inventory.js";
import { ServiceInventory } from "./ServiceInventory.js";

/**
 * Read against the machine actually running the tests: the service manager is
 * cheap to ask and only the real thing proves the parsing survives real output.
 */
describe("ServiceInventory", () => {
  const inventory = new ServiceInventory();
  const shell = new Shell(new LocalTransport().processes);

  let operatingSystem: OperatingSystem;
  let services: Record<string, ServiceFact>;

  beforeAll(async () => {
    operatingSystem = await OperatingSystem.detect(shell);
    services = await inventory.collect(shell, operatingSystem);
  });

  it("answers under the services section", () => {
    expect(inventory.section).toBe("services");
  });

  it("keys every service by the name the manager reports for it", () => {
    const entries = Object.entries(services);

    expect(entries.length).toBeGreaterThan(0);

    for (const [name, service] of entries) {
      expect(service.name).toBe(name);
    }
  });

  it("hands back a map to look names up in rather than a list to search", () => {
    expect(Array.isArray(services)).toBe(false);

    const [name] = Object.keys(services);

    expect(services[name]).toBeDefined();
  });

  it("leaves a name the service manager never reported out of the map", () => {
    const missing = "openstrap-service-that-was-never-installed";

    expect(missing in services).toBe(false);
    expect(services[missing]).toBeUndefined();
  });

  it("credits every service to the manager that belongs to this operating system", () => {
    const expected = operatingSystem.select({
      darwin: "launchd",
      linux: "systemd",
      windows: "windows-service-control-manager",
    });

    for (const service of Object.values(services)) {
      expect(service.manager).toBe(expected);
    }
  });

  it("marks every service it lists as present", () => {
    for (const service of Object.values(services)) {
      expect(service.status).toBe("present");
    }
  });

  it("answers running as a boolean for every service it lists", () => {
    for (const service of Object.values(services)) {
      expect(typeof service.running).toBe("boolean");
    }
  });

  it("finds at least one running service on a machine that is switched on", () => {
    expect(Object.values(services).some((service) => service.running === true)).toBe(true);
  });

  it("carries the manager's own state word for every service", () => {
    for (const service of Object.values(services)) {
      expect(typeof service.state).toBe("string");
    }
  });

  it("reports a pid only as a real number, never as an unparsed column", () => {
    for (const service of Object.values(services)) {
      if (service.pid !== undefined) {
        expect(Number.isInteger(service.pid)).toBe(true);
        expect(service.pid).toBeGreaterThan(0);
      }
    }
  });

  it("splits names off their own column instead of keeping whole output lines", () => {
    for (const name of Object.keys(services)) {
      expect(name).not.toBe("");
      expect(name).toMatch(/^\S+$/);
    }
  });

  it("reads the machine when collect is called, not when it is constructed", async () => {
    const fresh = new ServiceInventory();
    const first = await fresh.collect(shell, operatingSystem);
    const second = await fresh.collect(shell, operatingSystem);

    expect(first).not.toBe(second);
    expect(Object.keys(first).length).toBeGreaterThan(0);
    expect(Object.keys(second).length).toBeGreaterThan(0);
  });
});
