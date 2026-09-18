import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const doors = ["/Kubernetes.js", "/Kubernetes/index.js"];
const openstrapModules = [
  "Blueprint", "Plugin", "Requirements", "ConfigCore", "RemoteOpenStrap", "Steps",
  "StateStore", "Facts", "Create", "Connect", "Converge", "Deploy", "Secrets", "utils", "CLI",
];

describe("Kubernetes is a module of its own", () => {
  it("does not know that blueprints, facts, plugins or runs exist", () => {
    const offenders = sources().filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return openstrapModules.some((name) => new RegExp(`from\\s+["'][^"']*\\.\\./${name}/`).test(source));
    });
    expect(offenders.map(relative)).toEqual([]);
  });

  it("reaches outside itself for the project's vocabulary and the plugin contract, nothing else", () => {
    const root = join(process.cwd(), "src/Modules/Kubernetes");
    const vocabulary = join(process.cwd(), "src/types");
    const offenders = sources().filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)]
        .map((match) => resolve(dirname(filePath), match[1]!))
        .some((target) => !target.startsWith(`${root}/`) && !target.startsWith(`${vocabulary}/`));
    });
    expect(offenders.map(relative)).toEqual([]);
  });

  it("is reached from other modules only through its facade", () => {
    const outside = listSources(join(process.cwd(), "src")).filter((filePath) => !filePath.includes("/src/Modules/Kubernetes/"));
    const offenders = outside.filter((filePath) => {
      const imports = [...readFileSync(filePath, "utf8").matchAll(/from\s+["']([^"']*Modules\/Kubernetes\/[^"']*)["']/g)];
      return imports.some((match) => !doors.some((door) => match[1]!.endsWith(door)));
    });
    expect(offenders.map(relative)).toEqual([]);
  });

  it("is built out of classes, one to a file, named after the file", () => {
    const files = sources().filter((filePath) => !filePath.endsWith("/index.ts"));
    expect(files.length).toBeGreaterThan(3);
    for (const filePath of files) {
      const classes = [...readFileSync(filePath, "utf8").matchAll(/^export class (\w+)/gm)].map((match) => match[1]);
      expect(classes, relative(filePath)).toHaveLength(1);
      expect(filePath.endsWith(`/${classes[0]}.ts`), relative(filePath)).toBe(true);
    }
  });

  it("names nothing with a suffix the project forbids", () => {
    const banned = /class \w*(Orchestration|Orchestrator|Factory|Manager|Helper|Util|Handler|Processor)\b/;
    const offenders = sources().filter((filePath) => banned.test(readFileSync(filePath, "utf8")));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("speaks to a machine only through the channel it was handed, never by opening one", () => {
    const offenders = sources().filter((filePath) => /node:child_process|from "ssh2"/.test(readFileSync(filePath, "utf8")));
    expect(offenders.map(relative)).toEqual([]);
  });
});

function sources(): string[] {
  return listSources(join(process.cwd(), "src/Modules/Kubernetes")).filter((filePath) => !filePath.includes("/test/"));
}

function listSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      return listSources(filePath);
    }
    return filePath.endsWith(".ts") && !filePath.endsWith(".test.ts") ? [filePath] : [];
  });
}

function relative(filePath: string): string {
  return filePath.replace(`${process.cwd()}/`, "");
}
