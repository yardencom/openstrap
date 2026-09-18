import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Cli } from "../src/CLI/Main.js";

/**
 * Where this run keeps what it writes.
 *
 * `openstrap run` records the targets it read and the snapshots it took, and a test that recorded
 * them into the state of the machine it runs on would be leaving its subjects behind.
 */
const stateHome = mkdtempSync(join(tmpdir(), "openstrap-cli-state-"));

beforeAll(() => {
  process.env.OPENSTRAP_STATE_HOME = stateHome;
});

afterAll(() => {
  delete process.env.OPENSTRAP_STATE_HOME;
  rmSync(stateHome, { recursive: true, force: true });
});

describe("openstrap CLI", () => {
  it("runs the local sample and prints human output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml", "--local"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap run: passed");
    expect(output.stdout).toContain("node-runtime [local]: passed");
    expect(output.stderr).toBe("");
  });

  /**
   * A run is the whole cycle, not three quarters of it.
   *
   * The blueprint declares a file, the machine has not got one, and the step that writes it is in the
   * requirement it answers. A run that reported `failed` here would be telling the truth and leaving
   * the machine as it found it — which is what it did before the fourth stage existed.
   */
  it("brings a machine to what the blueprint declares rather than only reporting the shortfall", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-run-converge-"));
    const wanted = join(directory, "wanted.txt");

    try {
      writeFileSync(join(directory, "openstrap.yaml"), [
        "targets:",
        "  local:",
        "    requirements:",
        "      - id: the-file",
        "        paths:",
        "          wanted:",
        `            path: ${wanted}`,
        "            exists: true",
        "        steps:",
        "          - id: write-the-file",
        `            write: { path: ${wanted}, content: "openstrap was here" }`,
        "",
      ].join("\n"));

      const output = await captureCli(["run", "--local"], directory);

      expect(output.stdout).toContain("the-file [local]: passed");
      expect(output.exitCode).toBe(0);
      // The verdict is a reading taken after the step ran, so the file is there to be found.
      expect(existsSync(wanted)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("runs the local sample and prints JSON output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml", "--json", "--local"]);
    const json = JSON.parse(output.stdout);

    expect(output.exitCode).toBe(0);
    expect(json.requirementRun.status).toBe("passed");
    expect(json.snapshots).toHaveLength(1);
  });

  it("does not let a plugin replace how a machine is read", async () => {
    const output = await captureCli([
      "run",
      "examples/openstrap/local-run.yaml",
      "--facts-backend",
      "test:plugin-backend",
      "--json",
    ]);

    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain("--facts-backend");
    expect(output.stdout).toBe("");
  });

  it("fails when an explicit run config path is missing instead of falling back to workspace config", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-cli-explicit-"));

    try {
      writeFileSync(
        join(directory, "openstrap.yaml"),
        `
targets:
  local:
    requirements:
      - id: resources
        cpu:
          cores:
            minimum: 1
`,
      );

      const output = await captureCli(["run", join(directory, "missing.yaml"), "--local"], directory);

      expect(output.exitCode).toBe(2);
      expect(output.stderr).toContain("Config file was not found");
      expect(output.stdout).toBe("");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("collects host facts with nothing declared, and writes nothing anywhere", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-cli-facts-"));

    try {
      const output = await captureCli(["facts", "collect", "host", "--json"], directory);
      const data = JSON.parse(output.stdout).facts;

      expect(output.exitCode).toBe(0);
      expect(data.os.name).not.toBe("");
      expect(Object.keys(data.processes).length).toBeGreaterThan(0);
      // Nothing was asked about by name, so nothing is answered by name.
      expect(data.commands).toEqual({});
      expect(data.paths).toEqual({});
      // The answer is the answer. A run keeps its snapshots in the state store, and this command has
      // to leave nothing behind because it is what openstrap runs on a machine it was asked to read.
      expect(existsSync(join(directory, ".openstrap"))).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads what the blueprint under it is about, and all of the machine without one", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "openstrap-blueprint-"));

    writeFileSync(join(workspace, "openstrap.yaml"), [
      "targets:",
      "  host:",
      "    transport: local",
      "    requirements:",
      "      - id: node-present",
      "        runtimes:",
      "          node:",
      "            status: present",
    ].join("\n"));

    const byBlueprint = JSON.parse((await captureCli(["facts", "collect", "host", "--json"], workspace)).stdout);
    const entire = JSON.parse((await captureCli(["facts", "collect", "host", "--json", "--full"], workspace)).stdout);

    rmSync(workspace, { recursive: true, force: true });

    // The blueprint asks about one runtime, so one runtime is read and the rest of the machine is
    // not: no processes, no packages, no users.
    expect(Object.keys(byBlueprint.facts.runtimes)).toEqual(["node"]);
    expect(byBlueprint.facts.processes).toEqual({});
    expect(byBlueprint.facts.os).toBeUndefined();

    // `--full` in the same directory ignores it and reads the machine entire.
    expect(entire.facts.os.name).not.toBe("");
    expect(Object.keys(entire.facts.processes).length).toBeGreaterThan(0);
  });

  it("prints what it read", async () => {
    const output = await captureCli(["facts", "collect", "host"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap facts collect: success");
    expect(output.stdout).toContain("Target: host");
    expect(output.stderr).toBe("");
  });

  /**
   * A command openstrap did not write, reached without openstrap knowing it existed.
   *
   * The point of the whole mechanism: no branch here names `workloads`, no type lists it, and the
   * usage openstrap prints has a line it did not write. What decided all three is one line in the
   * project's own configuration.
   */
  it("answers to a word a plugin brought, and prints it in the plugin's own words", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-cli-plugin-"));

    writeFileSync(join(directory, "workloads.mjs"), `
      export default {
        name: "workloads",
        setup(api) {
          api.registerCommand({
            name: "workloads",
            usage: "openstrap workloads run <manifest>",
            parse: (args) => ({ sub: args[0] }),
            execute: async (args, context) => ({
              result: { did: args.sub, where: context.workspaceRoot },
              exitCode: args.sub === "run" ? 0 : 3,
            }),
            text: (result) => \`workloads \${result.did}\n\`,
          });
        },
      };
    `);
    writeFileSync(join(directory, "openstrap.config.mjs"), `
      import workloads from "./workloads.mjs";

      export default { plugins: [workloads] };
    `);

    const ran = await captureCli(["workloads", "run"], directory);
    const other = await captureCli(["workloads", "discover"], directory);
    const asJson = await captureCli(["workloads", "run", "--json"], directory);

    expect(ran.exitCode).toBe(0);
    expect(ran.stdout).toBe("workloads run\n");
    // The command's own exit code, because only the command knows what its result means.
    expect(other.exitCode).toBe(3);
    // `--json` is the one thing openstrap answers for every command, its own and anyone else's.
    expect(JSON.parse(asJson.stdout)).toMatchObject({ did: "run", where: directory });

    rmSync(directory, { recursive: true, force: true });
  });

  it("says what it answers to when asked for nothing at all", async () => {
    const output = await captureCli([]);

    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain("Missing command");
    expect(output.stderr).toContain("openstrap create vm <name>");
  });

  it("says what it does answer to when the word belongs to a plugin the project does not have", async () => {
    const output = await captureCli(["workloads", "run"]);

    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain('Unknown command "workloads"');
    expect(output.stderr).toContain("Known commands: run, create, converge, login, secret, tokens, list, connect, facts");
  });

});

async function captureCli(argv: readonly string[], cwd = process.cwd()) {
  let stdout = "";
  let stderr = "";
  const exitCode = await Cli.main(["node", "openstrap", ...argv], {
    cwd,
    stdout: {
      write: (chunk: string) => {
        stdout += chunk;
        return true;
      },
    } as any,
    stderr: {
      write: (chunk: string) => {
        stderr += chunk;
        return true;
      },
    } as any,
  });

  return {
    exitCode,
    stdout,
    stderr,
  };
}
