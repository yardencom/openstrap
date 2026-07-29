import { ZodConfigBackend } from "../adapters/zod/ZodConfigBackend.js";
import type { ConfigSchemaBackend } from "../ports/ConfigSchemaBackend.js";

export class ConfigSchemaBackendProvider {
  create(): ConfigSchemaBackend {
    return new ZodConfigBackend();
  }
}
