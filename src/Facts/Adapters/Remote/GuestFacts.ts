import type { Transport } from "../../../Transport/index.js";
import { createFactCollection } from "../../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest } from "../../Domain/FactCollectionRequest.js";
import type { FactCollection } from "../../Domain/Facts.js";

/**
 * Facts about a machine reached over a transport.
 *
 * The unit of variation is the operating system of the target, not the channel
 * used to reach it. This collector speaks POSIX to the target and would work
 * unchanged over any transport that can run a command — which is why there is
 * one collector rather than one per transport.
 */
export class GuestFacts {
  constructor(private readonly transport: Transport) {}

  async collect(request: FactCollectionRequest): Promise<FactCollection> {
    const now = (request.now ?? new Date()).toISOString();
    const items = [];

    for (const targetRequest of request.targets) {
      const target = targetRequest.target;
      const data = await this.probe();
      const snapshotId = `snap_${target.name}_${now.replace(/[-:.]/g, "")}`;

      items.push({
        snapshot: {
          id: snapshotId,
          schemaVersion: "facts.v1",
          scope: target.scope,
          target: {
            type: target.type,
            id: target.name,
            displayName: target.displayName,
          },
          data,
        },
        run: {
          id: `fact_run_${target.name}_${now.replace(/[-:.]/g, "")}`,
          snapshotId,
          startedAt: now,
          finishedAt: new Date().toISOString(),
          status: "success" as const,
          attempt: request.attempt ?? 1,
        },
      });
    }

    return createFactCollection(items);
  }

  /**
   * Reads everything in one round trip.
   *
   * An earlier version fired one command per section concurrently. A single
   * connection has a limited number of channels, so some of them failed and
   * the reader turned the failure into an empty string — facts quietly went
   * missing instead of the collection failing. One script cannot do that.
   */
  private async probe(): Promise<Record<string, unknown>> {
    const script = [
      'echo "arch=$(uname -m)"',
      'echo "cores=$(nproc 2>/dev/null || echo 0)"',
      '. /etc/os-release 2>/dev/null; echo "os_id=$ID"; echo "os_version=$VERSION_ID"; echo "os_pretty=$PRETTY_NAME"',
      'echo "kernel=$(uname -r)"',
      `awk '/MemTotal/ {print "mem_total=" $2 * 1024} /MemAvailable/ {print "mem_available=" $2 * 1024}' /proc/meminfo`,
      `df -B1 --output=size,avail / | tail -1 | awk '{print "disk_total=" $1; print "disk_available=" $2}'`,
      'sudo -n true 2>/dev/null && echo "sudo=yes" || echo "sudo=no"',
      '(systemctl is-active --quiet ssh || systemctl is-active --quiet sshd) && echo "sshd=yes" || echo "sshd=no"',
      'echo "python3=$(command -v python3 >/dev/null 2>&1 && python3 --version 2>&1 | head -1)"',
      'echo "node=$(command -v node >/dev/null 2>&1 && node --version 2>&1 | head -1)"',
    ].join("; ");

    const result = await this.transport.processes.capture({
      command: "sh",
      args: ["-c", script],
      cwd: "/",
    });

    if (result.exitCode !== 0) {
      throw new Error(`Could not collect facts from the target: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
    }

    const values = new Map(
      result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)] as const;
        }),
    );

    const read = (key: string): string => values.get(key) ?? "";
    const number = (key: string): number => Number(read(key)) || 0;
    const sudo = read("sudo") === "yes";
    const sshd = read("sshd") === "yes";
    const python = read("python3");
    const node = read("node");
    const architecture = read("arch");

    return {
      os: {
        family: "linux",
        name: read("os_id") || "linux",
        version: read("os_version"),
        kernel: read("kernel"),
        pretty: read("os_pretty"),
      },
      arch: architecture === "aarch64" ? "arm64" : architecture === "x86_64" ? "x64" : architecture,
      cpu: { cores: number("cores") },
      memory: { totalBytes: number("mem_total"), availableBytes: number("mem_available") },
      storage: { totalBytes: number("disk_total"), availableBytes: number("disk_available") },
      transports: {
        ssh: {
          status: sshd ? "present" : "absent",
          type: "ssh",
          ready: sshd,
          authMethods: ["publickey"],
        },
      },
      privileges: {
        mode: "sudo",
        sudo: { status: sudo ? "present" : "absent", passwordless: sudo },
      },
      runtimes: node
        ? { node: { status: "present", type: "node", version: versionIn(node), ready: true } }
        : {},
      tools: {
        python3: {
          status: python ? "present" : "absent",
          executable: Boolean(python),
          version: versionIn(python),
        },
      },
      paths: {},
      env: {},
    };
  }
}

function versionIn(output: string): string | undefined {
  return output.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1];
}
