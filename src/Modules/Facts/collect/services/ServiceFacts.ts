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
   *
   * Whether it comes back after a reboot is a different question, and it is asked separately — see
   * `startsAtBoot`. systeminformation answers `running` and has nothing to say about the other:
   * `services()` on Linux and macOS is `ps` matched by name, and a process list cannot know what a
   * service manager will start next time.
   */
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
   * A separate question from whether it is running, and the two disagree often enough to matter: a
   * service started by hand is running and will not be there after a reboot, and a service that is
   * enabled and has crashed is the other way round. A blueprint that says a cluster must survive a
   * restart is asking this one.
   *
   * Asked of the service manager, because it is the only thing that knows. Nothing is parsed —
   * `systemctl is-enabled` answers in its exit status, which is the same shape as the one other
   * place in this module where openstrap asks a program a yes-or-no question rather than reading a
   * value out of an API.
   *
   * Nothing comes back when there is nothing to ask. launchd has no equivalent single question, and
   * a manager the blueprint named itself is a manager this knows nothing about; in both cases the
   * field is left off rather than guessed at, and a requirement about it reports that it could not
   * be verified — which is true, and is not the same as saying the service is not enabled.
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
