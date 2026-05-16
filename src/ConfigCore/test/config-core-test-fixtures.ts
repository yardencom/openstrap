import { z } from "zod";

import {
  ConfigFilePatternDto,
  ConfigSchemaMetadataDto,
} from "../index.js";
import type { ZodConfigSchemaDefinition } from "../Adapters/ZodConfigSchemaDefinition.js";

export const exampleConfigSchema = z.strictObject({
  id: z.string().min(1),
  mode: z.enum(["strict", "loose"]).default("strict"),
  nested: z
    .strictObject({
      capture: z.enum(["metadata", "content"]).default("metadata"),
    })
    .optional(),
});

const exampleMetadata = new ConfigSchemaMetadataDto({
  kind: "example.config",
  schemaId: "https://openstrap.dev/schemas/example.schema.json",
  title: "Example config",
  description: "Example reusable config schema",
  filePatterns: [
    ConfigFilePatternDto.regex({
      pattern: String.raw`^.*\.example\.ya?ml$`,
      format: "yaml",
      description: "Example YAML config",
    }),
  ],
});

export const exampleDefinition: ZodConfigSchemaDefinition<typeof exampleConfigSchema> = {
  metadata: exampleMetadata,
  schema: exampleConfigSchema,
};
