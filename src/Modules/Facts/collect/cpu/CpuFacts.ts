import type { Asked } from "#types/FactDeclaration.js";
import { loadavg } from "node:os";

import si from "systeminformation";

import type { FactSections } from "#types/Facts.js";

/** What this machine computes with. */
export class CpuFacts {
  async cpu(declared: Asked | undefined): Promise<FactSections["cpu"]> {
    if (declared === undefined) {
      return undefined;
    }

    const cpu = await si.cpu();

    return {
      // Cores are packages of execution, threads are what the scheduler sees. A machine that
      // reports no physical count answers with the logical one rather than with zero, which would
      // read as a broken machine.
      cores: cpu.physicalCores || cpu.cores,
      threads: cpu.cores,
      model: CpuFacts.named(`${cpu.manufacturer} ${cpu.brand}`),
      vendor: CpuFacts.named(cpu.vendor) ?? CpuFacts.named(cpu.manufacturer),
      load: loadavg(),
    };
  }

  private static named(reported: string | undefined): string | undefined {
    const value = (reported ?? "").trim();

    return value === "" || value === "-" ? undefined : value;
  }
}

/** A name a tool actually reported, or nothing: `si` answers `-` for a model a vm does not expose. */
