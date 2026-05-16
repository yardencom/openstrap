import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { FactsConfig } from "../dist/FactsConfig/index.js";

const outputPath = resolve("schemas/facts-definition.schema.json");
const schema = new FactsConfig().getJsonSchema();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
