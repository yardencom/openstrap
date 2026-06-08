import { describe, expect, it } from "vitest";

import { runCli } from "../src/Cli/openstrap.js";

describe("openstrap CLI", () => {
  it("runs the local sample and prints human output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml"]);

    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain("OpenStrap run: passed");
    expect(output.stdout).toContain("node-runtime [host]: passed");
    expect(output.stderr).toBe("");
  });

  it("runs the local sample and prints JSON output", async () => {
    const output = await captureCli(["run", "examples/openstrap/local-run.yaml", "--json"]);
    const json = JSON.parse(output.stdout);

    expect(output.exitCode).toBe(0);
    expect(json.requirementRun.status).toBe("passed");
    expect(json.facts).toHaveLength(1);
  });
});

async function captureCli(argv: readonly string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(argv, {
    cwd: process.cwd(),
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
