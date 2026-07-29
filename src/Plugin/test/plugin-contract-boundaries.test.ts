import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const contractRoot = join(process.cwd(), "contract");

/**
 * A plugin depends on the contract, never on openstrap (ADR 0008).
 *
 * A plugin is a package released on its own, so a dependency on openstrap would put openstrap's code
 * inside it and tie its version to openstrap's internals. It happened: both plugins imported
 * `LocalTransport` and `KeychainSecretStore` — implementations, not a contract — and with them the
 * rule that a plugin is handed a reference to a secret rather than the secret.
 */
describe("The plugin contract", () => {
  it("is declarations only, so nothing of it is left in a built plugin", () => {
    const runtimeFiles = contractFiles().filter((filePath) => !filePath.endsWith(".d.ts"));

    expect(runtimeFiles.map(relative)).toEqual([]);
  });

  it("asks a plugin to call nothing to declare itself", () => {
    // A wrapper imported for type inference is a runtime dependency bought for nothing: the loader
    // checks the shape of whatever it loaded anyway, which is the only place the check can be trusted.
    for (const filePath of contractFiles()) {
      expect(readFileSync(filePath, "utf8"), relative(filePath)).not.toMatch(/export (declare )?function/);
    }

    expect(readFileSync(join(process.cwd(), "src/Plugin/index.ts"), "utf8")).not.toMatch(/define\w+\(/);
  });

  it("is a package of its own, which is what both sides depend on", () => {
    const contract = JSON.parse(readFileSync(join(contractRoot, "package.json"), "utf8"));
    const openstrap = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

    expect(contract.name).toBe("@openstrap/plugin-contract");
    expect(openstrap.dependencies).toHaveProperty("@openstrap/plugin-contract");
  });

  it("leaves a plugin nothing of openstrap to reach for", () => {
    const openstrap = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

    // Every subpath here is a right granted to whoever installs openstrap. A plugin needs none:
    // what it implements is in the contract, and what openstrap does with it is openstrap's own.
    for (const granted of ["./Plugin", "./Transport", "./StateStore", "./Secrets"]) {
      expect(Object.keys(openstrap.exports)).not.toContain(granted);
    }
  });
});

function contractFiles(): string[] {
  return listFiles(contractRoot).filter(
    (filePath) => !filePath.endsWith(".json") && !filePath.endsWith(".md"),
  );
}

function relative(filePath: string): string {
  return filePath.slice(process.cwd().length + 1);
}

function listFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);

    return statSync(entryPath).isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}
