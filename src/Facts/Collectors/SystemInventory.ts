import type { Transport } from "../../Transport/index.js";
import { OperatingSystem } from "./OperatingSystem.js";
import { PathInventory } from "./paths/PathInventory.js";
import { ProcessInventory } from "./processes/ProcessInventory.js";
import { ServiceInventory } from "./services/ServiceInventory.js";
import { Shell } from "./Shell.js";
import { SystemReadings } from "./system/SystemReadings.js";
import { ToolInventory } from "./tools/ToolInventory.js";

export type InventoryRequest = {
  /** Sections to read. Everything cheap is read when this is omitted. */
  sections?: readonly string[];
  tools?: readonly string[];
  paths?: Record<string, string>;
};

const alwaysRead = ["os", "arch", "cpu", "memory", "storage", "network", "users", "packages", "privileges"];

/**
 * Everything openstrap knows how to read from a machine.
 *
 * The pieces are parts of this inventory rather than swappable dependencies,
 * so it constructs them itself. What it does not construct is the shell: that
 * is the one real variation, because the same inventory is read from the host
 * over system calls and from a guest over SSH.
 */
export class SystemInventory {
  private readonly readings = new SystemReadings();
  private readonly processes = new ProcessInventory();
  private readonly services = new ServiceInventory();

  constructor(private readonly shell: Shell) {}

  static from(transport: Transport): SystemInventory {
    return new SystemInventory(new Shell(transport.processes));
  }

  /**
   * Reads the requested sections.
   *
   * Nothing is read in a constructor: reaching a guest waits on a network, and
   * a constructor cannot wait.
   */
  async read(request: InventoryRequest = {}): Promise<Record<string, unknown>> {
    const operatingSystem = await OperatingSystem.detect(this.shell);
    const wanted = (section: string): boolean =>
      request.sections === undefined || request.sections.includes(section) || alwaysRead.includes(section);

    const collected: Record<string, unknown> = {
      ...(await this.readings.read(this.shell, operatingSystem)),
      env: {},
    };

    collected.processes = wanted("processes")
      ? await this.processes.collect(this.shell, operatingSystem)
      : {};
    collected.services = wanted("services")
      ? await this.services.collect(this.shell, operatingSystem)
      : {};
    // Runtimes are derived from tools, so asking for one asks for the other.
    const tools = wanted("tools") || wanted("runtimes")
      ? await new ToolInventory(request.tools).collect(this.shell, operatingSystem)
      : {};

    collected.tools = wanted("tools") ? tools : {};
    const paths = await new PathInventory(request.paths ?? { home: "$HOME" }).collect(this.shell);

    collected.paths = wanted("paths") ? paths : {};
    collected.storage = this.withMounts(collected.storage, paths);
    collected.runtimes = this.runtimes(tools as Record<string, { status: string; version?: string }>);

    return collected;
  }

  /**
   * Where the paths that were asked about actually live.
   *
   * A requirement about free space means free space on the filesystem holding
   * a particular directory, so the directories asked about are named here
   * beside the totals.
   */
  private withMounts(storage: unknown, paths: Record<string, { path: string }>): Record<string, unknown> {
    return {
      ...(storage as Record<string, unknown>),
      mounts: Object.fromEntries(Object.entries(paths).map(([name, fact]) => [name, { path: fact.path }])),
    };
  }

  private runtimes(tools: Record<string, { status: string; version?: string }>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(tools)
        .filter(([name, tool]) => tool.status === "present" && (name === "node" || name === "python3"))
        .map(([name, tool]) => [name, { status: "present", type: name, version: tool.version, ready: true }]),
    );
  }
}
