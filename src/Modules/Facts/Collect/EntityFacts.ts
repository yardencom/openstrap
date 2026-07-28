import si from "systeminformation";
import which from "which";

import type {
  PackageDeclaration,
  ProcessDeclaration,
  ServiceDeclaration,
  ToolDeclaration,
} from "../Domain/FactDeclaration.js";
import type {
  PackageFact,
  ProcessFact,
  RuntimeFact,
  ServiceFact,
  ToolFact,
} from "../Domain/FactModel.js";
import type { Platform } from "./Platform.js";

/**
 * The tools almost every blueprint asks about.
 *
 * A caller that cares about something else says so; a caller that does not
 * should not have to spell out the obvious.
 */
const commonTools: readonly string[] = ["node", "npm", "python3", "git"];

/** Tools whose presence makes a runtime available to a blueprint. */
const runtimeTools: readonly string[] = ["node", "python3"];

/**
 * Tool names that systeminformation knows a version query for under another
 * spelling. Without the alias `python3` would read as present with no version.
 */
const versionAliases: Record<string, string> = {
  python3: "python",
};

/**
 * The things on a machine that are asked about by name.
 *
 * Processes, services, tools and packages all share one shape of question — "is
 * `sshd` there" — so they all answer the same way: a map keyed by the name the
 * caller used, with every declared name answered present or absent. A name that
 * produced no entry would be indistinguishable from a name nobody asked about,
 * which is why absence is a value here and never a gap.
 */
export class EntityFacts {
  constructor(private readonly platform: Platform) {}

  /**
   * The process table, plus an answer for every process the caller named.
   *
   * Both live in one section because both are facts about the same machine. The
   * table is keyed by `pid-<pid>`, which is the identity a process actually has;
   * a declared process is keyed by the name the caller gave it, because that is
   * what the caller will look for.
   */
  async processes(declared: Record<string, ProcessDeclaration>): Promise<Record<string, ProcessFact>> {
    const running = await si.processes();
    const table: Record<string, ProcessFact> = {};

    for (const entry of running.list) {
      table[`pid-${entry.pid}`] = {
        status: "present",
        pid: entry.pid,
        ppid: entry.parentPid,
        name: entry.name,
        user: entry.user,
        state: entry.state,
        command: entry.path ? `${entry.path}/${entry.name}` : entry.name,
        args: entry.params || undefined,
        startedAt: entry.started || undefined,
      };
    }

    for (const [id, declaration] of Object.entries(declared)) {
      table[id] = this.platform.matches(declaration.platforms)
        ? this.declaredProcess(declaration, id, running.list)
        : { status: "unsupported", reason: "platform_not_selected" };
    }

    return table;
  }

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

  /**
   * Where each tool asked about is, and what version it reports.
   *
   * The path comes from resolving the name on PATH, which is what "installed"
   * means to anything about to run it. The version comes from an API when there
   * is one for that tool; when there is not, the tool is still reported present
   * with no version rather than being run to see what it says about itself.
   */
  async tools(declared: Record<string, ToolDeclaration>): Promise<Record<string, ToolFact>> {
    const wanted = Object.keys(declared).length > 0
      ? Object.entries(declared).map(([id, declaration]) => ({ id, name: declaration.name ?? id, declaration }))
      : commonTools.map((name) => ({ id: name, name, declaration: {} as ToolDeclaration }));
    const versions = await si.versions(wanted.map((tool) => versionAliases[tool.name] ?? tool.name).join(","));
    const facts = await Promise.all(wanted.map(async (tool) => {
      if (!this.platform.matches(tool.declaration.platforms)) {
        return [tool.id, { status: "unsupported" as const, name: tool.name, reason: "platform_not_selected" }] as const;
      }

      const path = await which(tool.name, { nothrow: true });

      if (path === null) {
        return [tool.id, {
          status: "absent" as const,
          name: tool.name,
          executable: false,
        }] as const;
      }

      const reported = versions[(versionAliases[tool.name] ?? tool.name) as keyof typeof versions];

      return [tool.id, {
        status: "present" as const,
        name: tool.name,
        path,
        executable: true,
        version: typeof reported === "string" && reported !== "" ? reported : undefined,
      }] as const;
    }));

    return Object.fromEntries(facts);
  }

  /**
   * Which runtimes a blueprint can rely on.
   *
   * A runtime is a tool seen from the other side: a blueprint asking for "node
   * 18 or later" is asking whether it can run something, not where the binary
   * lives. Derived here rather than read again, so the two sections cannot
   * disagree about the same machine.
   */
  runtimes(tools: Record<string, ToolFact>): Record<string, RuntimeFact> {
    return Object.fromEntries(
      Object.entries(tools)
        .filter(([name, tool]) => tool.status === "present" && runtimeTools.includes(tool.name ?? name))
        .map(([name, tool]) => [tool.name ?? name, {
          status: "present" as const,
          type: tool.name ?? name,
          version: tool.version,
          ready: true,
        }]),
    );
  }

  /**
   * Installed packages, which no API reports portably.
   *
   * Every package manager answers a different question in a different format,
   * and none of them has an interface that is not its own command line. Saying
   * so is the honest answer: a caller that declared a package learns that
   * openstrap did not look, rather than that the package is missing.
   */
  packages(declared: Record<string, PackageDeclaration>): Record<string, PackageFact> {
    return Object.fromEntries(
      Object.entries(declared).flatMap(([id, declaration]) => declaration.names.map((name) => [
        declaration.names.length === 1 ? id : `${id}.${name}`,
        {
          status: "unsupported" as const,
          name,
          manager: declaration.manager,
          reason: "installed_packages_not_read",
        },
      ] as const)),
    );
  }

  private serviceManager(): string {
    return this.platform.select({
      linux: "systemd",
      macos: "launchd",
      windows: "windows-service-control-manager",
    });
  }

  /**
   * The processes a declaration matches.
   *
   * Every match is reported, because "is node running" and "how many node
   * processes are there" are the same question asked twice, and the first pid is
   * kept as well so a caller that expects one process does not have to unpack a
   * list.
   */
  private declaredProcess(
    declaration: ProcessDeclaration,
    id: string,
    running: readonly si.Systeminformation.ProcessesProcessData[],
  ): ProcessFact {
    const wantedName = declaration.name ?? (declaration.command === undefined ? id : undefined);
    const matches = running.filter((entry) => {
      if (wantedName !== undefined && !mentions(entry.name, wantedName)) {
        return false;
      }

      if (declaration.command !== undefined && !mentions(entry.name, declaration.command) && !entry.params.includes(declaration.command)) {
        return false;
      }

      return true;
    });
    const [first] = matches;

    if (!first) {
      return { status: "absent", name: wantedName ?? declaration.command, pids: [] };
    }

    return {
      status: "present",
      pids: matches.map((entry) => entry.pid),
      pid: first.pid,
      ppid: first.parentPid,
      name: first.name,
      user: first.user,
      state: first.state,
      command: first.path ? `${first.path}/${first.name}` : first.name,
    };
  }
}

/** A process is named by its executable, so `sshd` and `sshd.exe` are the same one. */
function mentions(reported: string, wanted: string): boolean {
  const name = reported.toLowerCase().endsWith(".exe") ? reported.slice(0, -4) : reported;

  return name === wanted || name.split("/").pop() === wanted;
}
