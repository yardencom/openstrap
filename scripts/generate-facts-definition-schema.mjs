import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Facts } from "../dist/Facts/index.js";

const outputPath = resolve("schemas/facts-definition.schema.json");
const schema = new Facts().getDefinitionJsonSchema();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
