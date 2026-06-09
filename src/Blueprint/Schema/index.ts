import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BlueprintJsonSchema } from "./BlueprintJsonSchema.js";

export { BlueprintJsonSchema } from "./BlueprintJsonSchema.js";

export function writeBlueprintJsonSchema(outputPath = "schemas/openstrap-blueprint.schema.json"): void {
  const resolvedOutputPath = resolve(outputPath);
  const schema = new BlueprintJsonSchema().emit();

  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, `${JSON.stringify(schema, null, 2)}\n`);
}

function isCliEntryPoint(importMetaUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(argvPath);
  } catch {
    return importMetaUrl === pathToFileURL(argvPath).href;
  }
}

if (isCliEntryPoint(import.meta.url, process.argv[1])) {
  writeBlueprintJsonSchema(process.argv[2]);
}
