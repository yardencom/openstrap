import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ConfigCore } from "../../ConfigCore/index.js";
import { BlueprintSchema } from "./BlueprintSchema.js";

export default function generateBlueprintSchema(): void {
  const outputPath = resolve("schemas/openstrap-blueprint.schema.json");
  const configCore = new ConfigCore();
  const schema = configCore.emitJsonSchema(new BlueprintSchema(configCore.schema));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
}

generateBlueprintSchema();
