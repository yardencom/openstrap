import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * The machines openstrap ships a build of itself for.
 *
 * Only the ones it reaches over a transport. The machine openstrap runs on already
 * has the openstrap that is running, so building a second one for it would be dead
 * weight in every release.
 */
const targets: readonly { id: string; pkgTarget: string }[] = [
  { id: "linux-arm64", pkgTarget: "node24-linuxstatic-arm64" },
  { id: "linux-x64", pkgTarget: "node24-linuxstatic-x64" },
];

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../..");
const output = join(repositoryRoot, "dist", "remote");

/**
 * Builds openstrap for the machines it delivers itself to.
 *
 * This is openstrap and not a program written to be sent: the entry point is the same
 * `src/CLI/index.ts` a person runs, and on the target it is asked
 * `openstrap facts collect`. There is nothing else to keep in step with it.
 *
 * Two steps, because they answer two different problems. Bundling collapses openstrap
 * and everything it depends on into one file, so nothing has to be resolved on the
 * target. Packaging puts a Node runtime around that file, so the target needs no
 * runtime of its own — reading a machine must not install anything on it.
 */
async function buildForLinux(): Promise<void> {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  const bundle = join(output, "openstrap.cjs");

  await build({
    entryPoints: [join(repositoryRoot, "src", "CLI", "index.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    minify: true,
    // CommonJS has no `import.meta`, so it is spelled out as absent rather than left to be quietly
    // emptied with a warning. openstrap reads it to find where its own files are, and answers that
    // question from the executable it was started as when it has no file of its own.
    define: { "import.meta.url": "undefined" },
  });

  for (const target of targets) {
    const binary = join(output, `openstrap-${target.id}`);

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
        // Built here and run on another architecture, so it ships as source rather
        // than as bytecode: a V8 bytecode cache is only valid for the V8 that
        // produced it, and the target's rejects it at startup.
        "--no-bytecode",
        "--public",
        "--public-packages",
        "*",
      ],
      { stdio: "inherit" },
    );

    // Written now, because what a built file's contents hash to is settled the moment
    // it is built. Working it out again at every reading meant reading 63 MiB and
    // hashing it, usually to rediscover the name of a file already on the target.
    writeFileSync(`${binary}.sha256`, createHash("sha256").update(readFileSync(binary)).digest("hex"));
  }

  rmSync(bundle, { force: true });
}

await buildForLinux();
