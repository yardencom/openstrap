import si from "systeminformation";

import type { FactSections } from "../../types/FactModel.js";

/** How much memory this machine has, and how much of it is free. */
export class MemoryFacts {
  async memory(declared: Record<string, never> | undefined): Promise<FactSections["memory"]> {
    if (declared === undefined) {
      return undefined;
    }

    const memory = await si.mem();

    return {
      totalBytes: memory.total,
      availableBytes: memory.available,
      swapTotalBytes: memory.swaptotal,
      swapUsedBytes: memory.swapused,
    };
  }
}
