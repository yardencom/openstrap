import type { Transport } from "../../Domain/Transport.js";
import { LocalFileSystem } from "./FileSystem.js";
import { LocalNetwork } from "./Network.js";
import { LocalProcesses } from "./Processes.js";

/**
 * Access to the machine openstrap itself runs on, through system calls.
 *
 * The three ports are parts of this transport rather than swappable
 * dependencies, so the facade constructs them directly.
 */
export class LocalTransport implements Transport {
  readonly fileSystem = new LocalFileSystem();
  readonly network = new LocalNetwork();
  readonly processes = new LocalProcesses();
}
