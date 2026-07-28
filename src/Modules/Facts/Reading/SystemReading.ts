import type { FactDeclaration } from "../Domain/FactDeclaration.js";
import type { FactData } from "../Domain/FactModel.js";

/**
 * Reading one machine.
 *
 * There are exactly two ways to do it and they differ only in where the reading
 * runs: in this process, or in an openstrap process on the machine being read.
 * The reading itself is the same code either way, which is why a guest and the
 * host produce snapshots that can be compared at all.
 *
 * Reading is asynchronous because reaching a machine can mean waiting on a
 * network, and because every underlying API answers that way.
 */
export interface SystemReading {
  read(declaration: FactDeclaration): Promise<FactData>;
}
