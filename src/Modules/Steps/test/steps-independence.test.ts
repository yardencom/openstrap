import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/** The names the module answers to. */
const doors = ["/Steps.js", "/Steps/index.js"];

const openstrapModules = [
  "Blueprint", "Plugin", "Requirements", "ConfigCore", "RemoteOpenStrap",
  "StateStore", "Facts", "Create", "Connect", "Converge", "Secrets", "utils", "CLI",
];

/**
 * The rule that makes this an engine rather than a catalogue.
 *
 * Every convergence tool in this field ships a library of knowledge — apt, yum, systemd, launchd, a
 * thousand Ansible modules — and that library is most of what they are. openstrap ships none. What
 * to do about a machine is said by a resolver: a plugin, or steps written in a blueprint beside the
 * requirement they answer.
 *
 * Written as a test rather than as an intention, because an intention is a thing somebody adds one
 * `apt-get` to on a Friday. This is the guarantee.
 */
const knowledgeAboutMachines = [
  "apt", "apt-get", "dpkg", "yum", "dnf", "rpm", "apk", "pacman", "zypper", "brew", "snap",
  "systemctl", "systemd", "service", "launchctl", "rc-service", "chkconfig",
  "docker", "podman", "kubectl", "kubeadm", "k3s", "k0s", "helm", "nomad",
  "ubuntu", "debian", "alpine", "centos", "fedora",
];

describe("Steps is a module of its own", () => {
  it("does not know that blueprints, facts, plugins, transports or runs exist", () => {
    const offenders = stepsSources().filter((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return openstrapModules.some((name) => new RegExp(`from\\s+["'][^"']*\\.\\./${name}/`).test(source));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("reaches outside itself for the project's vocabulary and nothing else", () => {
    const stepsRoot = join(process.cwd(), "src/Modules/Steps");
    const vocabulary = join(process.cwd(), "src/types");
    const offenders = stepsSources().filter((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)]
        .map((match) => resolve(dirname(filePath), match[1]!))
        .some((target) => !target.startsWith(`${stepsRoot}/`) && !target.startsWith(`${vocabulary}/`));
    });

    expect(offenders.map(relative)).toEqual([]);
  });

  it("is reached from other modules only through its facade", () => {
    const outside = listSources(join(process.cwd(), "src"))
      .filter((filePath) => !filePath.includes("/src/Modules/Steps/"));
    const offenders = outside.filter((filePath) => {
      const imports = [...readFileSync(filePath, "utf8").matchAll(/from\s+["']([^"']*Modules\/Steps\/[^"']*)["']/g)];

      return imports.some((match) => !doors.some((door) => match[1]!.endsWith(door)));
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("Working out steps and running them", () => {
  it("knows no package, no service manager, no distribution and no product", () => {
    const offenders = stepsSources().flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return knowledgeAboutMachines
        .filter((word) => new RegExp(`\\b${word}\\b`, "i").test(source))
        .map((word) => `${relative(filePath)}: ${word}`);
    });

    expect(offenders).toEqual([]);
  });

  it("never takes a channel of access, because it runs where the machine is", () => {
    const offenders = stepsSources().filter((filePath) =>
      /Transport|TransportConnection|\.processes\b|\.fileSystem\b/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("never decides for itself when to stop, because that is a loop over three modules", () => {
    const offenders = stepsSources().filter((filePath) =>
      /\b(maxPasses|passes|converged|retry|attempt)\b/.test(readFileSync(filePath, "utf8")),
    );

    expect(offenders.map(relative)).toEqual([]);
  });

  it("is built out of classes, one to a file, named after the file", () => {
    const sources = stepsSources().filter((filePath) => !filePath.endsWith("/index.ts"));

    expect(sources.length).toBeGreaterThan(3);

    for (const filePath of sources) {
      const source = readFileSync(filePath, "utf8");
      const classes = [...source.matchAll(/^export class (\w+)/gm)].map((match) => match[1]);

      expect(classes, relative(filePath)).toHaveLength(1);
      expect(filePath.endsWith(`/${classes[0]}.ts`), relative(filePath)).toBe(true);
    }
  });

  it("names nothing with a suffix the project forbids", () => {
    const banned = /class \w*(Orchestration|Orchestrator|Factory|Manager|Helper|Util|Service|Handler|Processor)\b/;
    const offenders = stepsSources().filter((filePath) => banned.test(readFileSync(filePath, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
  });
});

function stepsSources(): string[] {
  return listSources(join(process.cwd(), "src/Modules/Steps"))
    .filter((filePath) => !filePath.includes(".test.") && !filePath.includes("/test/"));
}

function relative(filePath: string): string {
  return filePath.slice(filePath.indexOf("/src/") + 1);
}

function listSources(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);

    return statSync(entryPath).isDirectory()
      ? listSources(entryPath)
      : entryPath.endsWith(".ts") ? [entryPath] : [];
  });
}
