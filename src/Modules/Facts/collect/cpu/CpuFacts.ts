import { loadavg } from "node:os";

import si from "systeminformation";

import type { FactSections } from "../../domain/FactModel.js";

/** What this machine computes with. */
export class CpuFacts {
  async cpu(declared: Record<string, never> | undefined): Promise<FactSections["cpu"]> {
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
      model: named(`${cpu.manufacturer} ${cpu.brand}`),
      vendor: named(cpu.vendor) ?? named(cpu.manufacturer),
      load: loadavg(),
    };
  }
}

/**
 * A name a tool actually reported, or nothing.
 *
 * Placeholders travel: `si` answers `-` for a cpu model a virtual machine does
 * not expose, and a snapshot saying the model is `-` is worse than one saying
 * nothing, because it reads like an answer.
 */
function named(reported: string | undefined): string | undefined {
  const value = (reported ?? "").trim();

  return value === "" || value === "-" ? undefined : value;
}
