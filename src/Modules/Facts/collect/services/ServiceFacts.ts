import { execFile } from "node:child_process";
import { promisify } from "node:util";

import si from "systeminformation";

import type { ServiceDeclaration } from "#types/FactDeclaration.js";
import type { ServiceFact } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

const run = promisify(execFile);

/** Which services are running, one declared name at a time. */
export class ServiceFacts {
  constructor(private readonly platform: Platform) {}

  /** Services, answered one declared name at a time. */
  async services(declared: Record<string, ServiceDeclaration> | undefined): Promise<Record<string, ServiceFact>> {
    if (declared === undefined) {
      return {};
    }

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
      const atBoot = await this.startsAtBoot(name, manager);

      if (answer === undefined) {
        services[id] = { status: "absent", name, manager, ...atBoot, reason: "service_not_reported" };
        continue;
      }

      services[id] = answer.running
        ? {
            status: "present",
            name,
            manager,
            running: true,
            state: "running",
            ...atBoot,
            pid: answer.pids?.[0],
            pids: answer.pids ?? [],
          }
        : {
            status: "absent",
            name,
            manager,
            running: false,
            state: "stopped",
            ...atBoot,
            pids: [],
            reason: "service_not_running",
          };
    }

    return services;
  }

  /**
   * Whether the service manager will start this service on its own next time the machine boots.
   *
   * Asked of the service manager, the only thing that knows: `services()` here is `ps` matched by
   * name, and a process list cannot know what starts next time. Nothing is parsed — `systemctl
   * is-enabled` answers in its exit status. Nothing comes back where there is nothing to ask, and a
   * requirement then reports that it could not be verified, which is not "not enabled".
   */
  private async startsAtBoot(name: string, manager: string): Promise<{ enabled?: boolean }> {
    if (manager !== "systemd") {
      return {};
    }

    try {
      await run("systemctl", ["is-enabled", "--quiet", name], { timeout: 5000 });

      return { enabled: true };
    } catch (error) {
      // No systemd to ask — a container, or a Linux that boots something else. An exit status is an
      // answer; a missing program is not, and reporting `false` for it would be an invention.
      return (error as { code?: unknown }).code === "ENOENT" ? {} : { enabled: false };
    }
  }

  private serviceManager(): string {
    return this.platform.select({
      linux: "systemd",
      macos: "launchd",
      windows: "windows-service-control-manager",
    });
  }
}
