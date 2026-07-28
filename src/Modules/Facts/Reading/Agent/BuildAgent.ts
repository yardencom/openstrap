import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * The machines openstrap ships a facts agent for.
 *
 * Only the ones it reaches over a transport. The machine openstrap itself runs on
 * is read in process and needs no agent, so building one for it would be dead
 * weight in every release.
 */
const targets: readonly { id: string; pkgTarget: string }[] = [
  { id: "linux-arm64", pkgTarget: "node24-linuxstatic-arm64" },
  { id: "linux-x64", pkgTarget: "node24-linuxstatic-x64" },
];

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../../../../..");
const output = join(repositoryRoot, "dist", "agent");

/**
 * Builds the agents.
 *
 * Two steps, because they answer two different problems. Bundling collapses the
 * reading and everything it depends on into one file, so nothing has to be
 * resolved on the target. Packaging puts a Node runtime around that file, so the
 * target needs no runtime of its own — reading a machine must not install
 * anything on it.
 */
async function buildAgents(): Promise<void> {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  const bundle = join(output, "agent.cjs");

  await build({
    entryPoints: [join(here, "AgentMain.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    minify: true,
  });

  for (const target of targets) {
    const binary = join(output, `openstrap-facts-${target.id}`);

    process.stdout.write(`building ${binary}\n`);
    execFileSync(
      process.execPath,
      [
        join(repositoryRoot, "node_modules", "@yao-pkg", "pkg", "lib-es5", "bin.js"),
        bundle,
        "--target",
        target.pkgTarget,
        "--output",
        binary,
        // The agent is built here and run on another architecture, so it ships as
        // source rather than as bytecode: a V8 bytecode cache is only valid for
        // the V8 that produced it, and the target's rejects it at startup.
        "--no-bytecode",
        "--public",
        "--public-packages",
        "*",
      ],
      { stdio: "inherit" },
    );
  }

  rmSync(bundle, { force: true });
}

await buildAgents();
