import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Blueprints } from "../dist/Blueprint/index.js";

const outputPath = resolve("schemas/openstrap-blueprint.schema.json");
const schema = new Blueprints().getJsonSchema();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
