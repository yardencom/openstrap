import type { FileSystemAPI } from "./FileSystem.js";
import type { NetworkAPI } from "./Network.js";
import type { ProcessAPI } from "./Process.js";

/**
 * A channel of access to a target, plus the operations performed through it.
 *
 * Progress output and the openstrap process environment are deliberately absent:
 * they belong to the host process, not to the channel. The port also returns no
 * derived data — deciding which operating system a target runs is fact collection,
 * not transport.
 */
export type Transport = {
  fileSystem: FileSystemAPI;
  network: NetworkAPI;
  processes: ProcessAPI;
};
