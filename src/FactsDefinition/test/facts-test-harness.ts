import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { FactsDefinitionReader } from "../index.js";

export const factsDefinitionReader = new FactsDefinitionReader();

export function parseYaml(yamlText: string): any {
  return factsDefinitionReader.parseYaml(yamlText);
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
