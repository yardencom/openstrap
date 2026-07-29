import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * The machines openstrap is built for.
 *
 * One list, and it is the release: the machine a person installs openstrap on and the machines
 * openstrap delivers itself to are the same machines, because it is the same program. A target whose
 * platform is not here cannot be read, and says so.
 */
const platforms: readonly { id: string; pkgTarget: string }[] = [
  { id: "darwin-arm64", pkgTarget: "node24-macos-arm64" },
  { id: "darwin-x64", pkgTarget: "node24-macos-x64" },
  { id: "linux-arm64", pkgTarget: "node24-linuxstatic-arm64" },
  { id: "linux-x64", pkgTarget: "node24-linuxstatic-x64" },
];

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(repositoryRoot, "bin");

/**
 * Builds openstrap.
 *
 * Two steps, because they answer two different problems. Bundling collapses openstrap and everything
 * it depends on into one file, so nothing has to be resolved where it lands. Packaging puts a Node
 * runtime around that file, so the machine it lands on needs no runtime of its own — installing
 * openstrap must not mean installing Node, and reading a machine must not install anything at all.
 *
 * Beside each binary goes the digest of its contents. openstrap names the copy it delivers after it,
 * so an unchanged build is never sent twice and a changed one is never mistaken for the old one, and
 * working it out at delivery time meant reading 63 MiB and hashing it on every reading.
 */
async function buildBinaries(): Promise<void> {
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

  for (const platform of platforms) {
    const binary = join(output, `openstrap-${platform.id}`);

    process.stdout.write(`building ${binary}\n`);
    execFileSync(
      process.execPath,
      [
        join(repositoryRoot, "node_modules", "@yao-pkg", "pkg", "lib-es5", "bin.js"),
        bundle,
        "--target",
        platform.pkgTarget,
        "--output",
        binary,
        // Built here and run on another architecture, so it ships as source rather than as bytecode:
        // a V8 bytecode cache is only valid for the V8 that produced it, and the target's rejects it
        // at startup.
        "--no-bytecode",
        "--public",
        "--public-packages",
        "*",
      ],
      { stdio: "inherit" },
    );

    writeFileSync(`${binary}.sha256`, createHash("sha256").update(readFileSync(binary)).digest("hex"));
  }

  rmSync(bundle, { force: true });
}

await buildBinaries();
