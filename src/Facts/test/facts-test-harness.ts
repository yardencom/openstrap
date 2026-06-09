import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { Facts } from "../index.js";

export const facts = new Facts();

export function parseYaml(yamlText: string): any {
  return facts.parseDefinitionYaml(yamlText);
}

export function listSourceFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return entryPath.endsWith(".ts") ? [entryPath] : [];
  });
}
