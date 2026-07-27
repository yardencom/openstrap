import type { Transport } from "../../Transport/index.js";
import { probesByOperatingSystem, toolProbes, type OperatingSystemName } from "./OperatingSystems.js";
import { readings, script, versionIn } from "./Probe.js";

export class UnsupportedOperatingSystemError extends Error {
  constructor(uname: string) {
    super(`openstrap does not know how to collect facts from "${uname}"`);
    this.name = "UnsupportedOperatingSystemError";
  }
}

/**
 * Collects facts from a target through a transport.
 *
 * There is one of these, not one per channel. What varies is the operating
 * system of the target; how the target is reached does not change what a fact
 * is or which facts exist. The host is not a special case — it is the local
 * transport, and it goes through exactly this code.
 */
export class SystemCollector {
  constructor(private readonly transport: Transport) {}

  async collect(): Promise<Record<string, unknown>> {
    const operatingSystem = await this.operatingSystem();
    const probes = [...probesByOperatingSystem[operatingSystem], ...toolProbes];
    const output = await this.run(script(probes));
    const read = readings(output);

    const architecture = read.get("arch");
    const tools = Object.fromEntries(
      toolProbes.map((probe) => {
        const name = probe.key.slice("tool_".length);
        const raw = read.get(probe.key);

        return [name, {
          status: raw ? "present" : "absent",
          type: name,
          executable: Boolean(raw),
          ready: Boolean(raw),
          version: versionIn(raw),
        }];
      }),
    );

    return {
      os: {
        family: operatingSystem === "darwin" ? "macos" : "linux",
        name: read.get("os_name"),
        version: read.get("os_version"),
        kernel: read.get("kernel"),
        pretty: read.get("os_pretty"),
      },
      arch: normalizeArch(architecture),
      cpu: { cores: read.number("cpu_cores"), threads: read.number("cpu_cores"), model: read.get("cpu_model") },
      memory: { totalBytes: read.number("mem_total"), availableBytes: read.number("mem_available") },
      storage: { totalBytes: read.number("disk_total"), availableBytes: read.number("disk_available") },
      network: { hostname: read.get("hostname") },
      users: { current: { name: read.get("user"), home: read.get("home") } },
      packages: { managers: { [read.get("package_manager")]: { status: "present" } } },
      processes: { count: read.number("process_count") },
      services: { count: read.number("service_count") },
      transports: {
        ssh: {
          status: read.flag("sshd") ? "present" : "absent",
          type: "ssh",
          ready: read.flag("sshd"),
          authMethods: ["publickey"],
        },
      },
      privileges: {
        mode: read.flag("admin") ? "root" : "sudo",
        admin: { status: read.flag("admin") ? "present" : "absent" },
        sudo: {
          status: read.flag("sudo") ? "present" : "absent",
          passwordless: read.flag("sudo"),
        },
      },
      runtimes: nodeRuntime(tools.node),
      paths: { home: { status: "present", path: read.get("home"), exists: true, type: "directory", readable: true } },
      tools,
      env: {},
    };
  }

  /**
   * Which operating system the target runs.
   *
   * This is the one thing that must be known before anything else can be
   * asked, so it is a question of its own rather than part of the table.
   */
  private async operatingSystem(): Promise<OperatingSystemName> {
    const uname = (await this.run("uname -s")).trim();

    if (uname === "Linux") {
      return "linux";
    }

    if (uname === "Darwin") {
      return "darwin";
    }

    throw new UnsupportedOperatingSystemError(uname || "unknown");
  }

  private async run(command: string): Promise<string> {
    const result = await this.transport.processes.capture({
      command: "sh",
      args: ["-c", command],
      cwd: "/",
    });

    if (result.exitCode !== 0) {
      throw new Error(`Could not read facts from the target: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
    }

    return result.stdout;
  }
}

function nodeRuntime(node: { status: string; version?: string } | undefined): Record<string, unknown> {
  return node?.status === "present"
    ? { node: { status: "present", type: "node", version: node.version, ready: true } }
    : {};
}

function normalizeArch(architecture: string): string {
  if (architecture === "aarch64" || architecture === "arm64") {
    return "arm64";
  }

  return architecture === "x86_64" ? "x64" : architecture;
}
