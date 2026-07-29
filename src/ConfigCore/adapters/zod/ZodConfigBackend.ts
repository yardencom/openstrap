import type { ConfigSchemaBackend } from "../../ports/ConfigSchemaBackend.js";
import { ZodConfigSchemaBuilder } from "./ZodConfigSchemaBuilder.js";
import { ZodConfigValidator } from "./ZodConfigValidator.js";
import { ZodJsonSchemaEmitter } from "./ZodJsonSchemaEmitter.js";
import { ZodSchemaMetadataRegistry } from "./ZodSchemaMetadataRegistry.js";
import { ZodSchemaRegistry } from "./ZodSchemaRegistry.js";

export class ZodConfigBackend implements ConfigSchemaBackend {
  readonly schemaBuilder: ZodConfigSchemaBuilder;
  readonly validator: ZodConfigValidator;
  readonly jsonSchemaEmitter: ZodJsonSchemaEmitter;

  constructor(
    schemas = new ZodSchemaRegistry(),
    metadata = new ZodSchemaMetadataRegistry(),
  ) {
    this.schemaBuilder = new ZodConfigSchemaBuilder(schemas, metadata);
    this.validator = new ZodConfigValidator(schemas);
    this.jsonSchemaEmitter = new ZodJsonSchemaEmitter(schemas);
  }
}
