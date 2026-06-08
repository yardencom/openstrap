import { ZodConfigBackend } from "../Adapters/Zod/ZodConfigBackend.js";
import type { ConfigSchemaBackend } from "../Ports/ConfigSchemaBackend.js";

export class ConfigSchemaBackendProvider {
  create(): ConfigSchemaBackend {
    return new ZodConfigBackend();
  }
}
