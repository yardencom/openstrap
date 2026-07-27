import type { Inventory, ServiceFact } from "../Inventory.js";
import type { OperatingSystem } from "../OperatingSystem.js";
import type { Shell } from "../Shell.js";

/** How one service manager is asked for its services, and how it answers. */
type ServiceListing = {
  readonly command: string;
  readonly read: (output: string) => ServiceFact[];
};

/**
 * The services the target's own service manager knows about.
 *
 * Keyed by service name, because that is how a requirement asks the question:
 * "is `sshd` running" can be answered by a map and only searched for in a list.
 * A name the manager never mentioned is simply absent — no entry is invented
 * for it here, since this section reports what the machine says, not what
 * somebody hoped to find.
 *
 * Which manager is asked follows from the operating system and nothing else.
 * Listing the services is a fault when it fails: a broken `launchctl` must not
 * read back as a machine with no services at all, so the command runs through
 * `shell.run` and the failure travels.
 */
export class ServiceInventory implements Inventory {
  readonly section = "services";

  async collect(shell: Shell, operatingSystem: OperatingSystem): Promise<Record<string, ServiceFact>> {
    const listing = operatingSystem.select<ServiceListing>({
      darwin: {
        command: "launchctl list",
        read: (output) => this.readLaunchdServices(output),
      },
      linux: {
        command: "systemctl list-units --type=service --all --no-legend --no-pager",
        read: (output) => this.readSystemdServices(output),
      },
      windows: {
        command: "sc query state= all",
        read: (output) => this.readWindowsServices(output),
      },
    });

    return this.keyByName(listing.read(await shell.run(listing.command)));
  }

  /** `launchctl list` answers three columns: PID, last exit status, label. */
  private readLaunchdServices(output: string): ServiceFact[] {
    return output
      .split("\n")
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 3)
      .map(([pid, exitStatus, name]) => {
        const started = /^\d+$/.test(pid);

        return {
          status: "present" as const,
          manager: "launchd",
          name,
          running: started && Number(pid) > 0,
          pid: started ? Number(pid) : undefined,
          state: exitStatus,
        };
      });
  }

  /** `systemctl list-units` answers UNIT, LOAD, ACTIVE, SUB, DESCRIPTION. */
  private readSystemdServices(output: string): ServiceFact[] {
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts[0]?.endsWith(".service"))
      .map((parts) => ({
        status: "present" as const,
        manager: "systemd",
        name: parts[0],
        running: parts[3] === "running",
        state: parts[3],
      }));
  }

  /** `sc query` answers a paragraph per service; the name heads it. */
  private readWindowsServices(output: string): ServiceFact[] {
    const services: ServiceFact[] = [];
    let currentName: string | undefined;

    for (const line of output.split("\n")) {
      const serviceName = line.match(/SERVICE_NAME:\s*(.+)$/);

      if (serviceName) {
        currentName = serviceName[1]?.trim();
        continue;
      }

      const state = line.match(/STATE\s+:\s+\d+\s+(\S+)/);

      if (state && currentName) {
        services.push({
          status: "present",
          manager: "windows-service-control-manager",
          name: currentName,
          running: state[1] === "RUNNING",
          state: state[1]?.toLowerCase(),
        });
        currentName = undefined;
      }
    }

    return services;
  }

  private keyByName(services: readonly ServiceFact[]): Record<string, ServiceFact> {
    return Object.fromEntries(services.map((service) => [service.name, service]));
  }
}
