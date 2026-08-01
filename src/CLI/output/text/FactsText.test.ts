import { describe, expect, it } from "vitest";

import { FactsText } from "./FactsText.js";
import type { FactsCollectResult } from "../../application/FactsCollectCommand.js";

/**
 * What a person sees, for readings of every width.
 *
 * This file exists because it did not. A reading narrowed by a blueprint has five sections out of
 * nineteen, and this printer assumed all of them: the first such reading died on `os.display` while
 * the same snapshot printed as JSON without complaint. Nothing here was watching, so the crash was
 * found by running the command.
 */
describe("printing what was read", () => {
  it("prints a whole machine", () => {
    const printed = new FactsText().print(snapshot({
      os: { name: "ubuntu", kernel: "6.8.0", display: { pretty: "Ubuntu 24.04.4 LTS" } },
      arch: "arm64",
      cpu: { cores: 2 },
      memory: { totalBytes: 2 * 1024 ** 3, availableBytes: 1024 ** 3 },
      storage: { totalBytes: 40 * 1024 ** 3, availableBytes: 30 * 1024 ** 3 },
      privileges: { mode: "sudo" },
      users: { openstrap: { name: "openstrap" } },
      processes: { "pid-1": {} },
    }));

    expect(printed).toContain("Ubuntu 24.04.4 LTS arm64, kernel 6.8.0");
    expect(printed).toContain("cpu      2 cores");
    expect(printed).toContain("memory   1.0 GiB of 2.0 GiB available");
    expect(printed).toContain("storage  30.0 GiB of 40.0 GiB available");
    expect(printed).toContain("user     openstrap (sudo)");
    expect(printed).toContain("processes  1");
  });

  it("prints a reading as narrow as the blueprint that asked for it", () => {
    const printed = new FactsText().print(snapshot({
      cpu: { cores: 2 },
      memory: { totalBytes: 2 * 1024 ** 3, availableBytes: 1024 ** 3 },
      services: { k3s: { status: "absent" } },
      tools: { kubectl: { status: "absent" } },
    }));

    expect(printed).toContain("cpu      2 cores");
    expect(printed).toContain("services   1");
    expect(printed).toContain("tools      1");

    // Not asked about, so not printed. `unknown` would say openstrap looked and could not tell.
    expect(printed).not.toContain("kernel");
    expect(printed).not.toContain("storage");
    expect(printed).not.toContain("user ");
    expect(printed).not.toContain("packages");
  });

  it("prints a reading with nothing in it at all", () => {
    const printed = new FactsText().print(snapshot({}));

    expect(printed).toContain("OpenStrap facts collect: success");
    expect(printed).toContain("Target: ubuntu-vm");
  });

  it("says what it does know when a section is there but half empty", () => {
    const printed = new FactsText().print(snapshot({
      arch: "arm64",
      cpu: {},
      memory: {},
    }));

    expect(printed).toContain("arm64");
    expect(printed).toContain("cpu      unknown cores");
    expect(printed).toContain("memory   unknown of unknown available");
  });
});

function snapshot(facts: Record<string, unknown>): FactsCollectResult {
  return {
    id: "snap_ubuntu-vm_20260801T120000000Z",
    schemaVersion: "facts.v1",
    scope: "guest",
    target: { type: "vm", id: "ubuntu-vm" },
    facts,
    reading: { status: "success" },
  } as unknown as FactsCollectResult;
}
