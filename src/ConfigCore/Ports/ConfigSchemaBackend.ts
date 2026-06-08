import type { ConfigJsonSchemaBackend } from "./ConfigJsonSchemaBackend.js";
import type { ConfigSchemaBuilderBackend } from "./ConfigSchemaBuilderBackend.js";
import type { ConfigValidatorBackend } from "./ConfigValidatorBackend.js";

export type ConfigSchemaBackend = {
  readonly schemaBuilder: ConfigSchemaBuilderBackend;
  readonly validator: ConfigValidatorBackend;
  readonly jsonSchemaEmitter: ConfigJsonSchemaBackend;
};
