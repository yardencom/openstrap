import si from "systeminformation";

import type { ServiceDeclaration } from "../../domain/FactDeclaration.js";
import type { ServiceFact } from "../../domain/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/** Which services are running, one declared name at a time. */
export class ServiceFacts {
  constructor(private readonly platform: Platform) {}

  /**
   * Services, answered one declared name at a time.
   *
   * A machine is never asked for all of its services: no requirement is written
   * against a list, and no service manager answers such a question the same way
   * twice. Asking by name is both what callers need and what every platform can
   * actually answer.
   *
   * A service is present when it is running. A service that is installed but
   * stopped reads as absent — deliberately, because that is the strongest claim
   * that holds on every platform: launchd offers no way to ask whether a label
   * exists without asking whether it is loaded, and to anything that depends on a
   * service the two states are the same. `running` carries the same answer
   * explicitly, so a requirement can be written either way.
   */
  async services(declared: Record<string, ServiceDeclaration>): Promise<Record<string, ServiceFact>> {
    const applicable = Object.entries(declared).filter(([, declaration]) => this.platform.matches(declaration.platforms));
    const wanted = applicable.map(([id, declaration]) => declaration.name ?? id);
    const reported = wanted.length === 0 ? [] : await si.services(wanted.join(","));
    const services: Record<string, ServiceFact> = {};

    for (const [id, declaration] of Object.entries(declared)) {
      if (!this.platform.matches(declaration.platforms)) {
        services[id] = { status: "unsupported", reason: "platform_not_selected" };
        continue;
      }

      const name = declaration.name ?? id;
      // systeminformation answers under a lowercased name, so a service asked
      // for as `WindowServer` comes back as `windowserver`.
      const answer = reported.find((service) => service.name === name.toLowerCase() || service.name === name);
      const manager = declaration.manager ?? this.serviceManager();

      if (answer === undefined) {
        services[id] = { status: "absent", name, manager, reason: "service_not_reported" };
        continue;
      }

      services[id] = answer.running
        ? {
            status: "present",
            name,
            manager,
            running: true,
            state: "running",
            pid: answer.pids?.[0],
            pids: answer.pids ?? [],
          }
        : {
            status: "absent",
            name,
            manager,
            running: false,
            state: "stopped",
            pids: [],
            reason: "service_not_running",
          };
    }

    return services;
  }

  private serviceManager(): string {
    return this.platform.select({
      linux: "systemd",
      macos: "launchd",
      windows: "windows-service-control-manager",
    });
  }
}
