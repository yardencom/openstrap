import { describe, expect, it } from "vitest";

import {
  ConfigLoader,
  ConfigSchemaDefinitionDto,
  ConfigSchemaMetadataDto,
  ConfigSchemaValidator,
  ConfigValidationError,
  configSchema,
} from "../index.js";
import { YamlConfigDocumentParser } from "../Adapters/YamlConfigDocumentParser.js";
import { ZodConfigValidator } from "../Adapters/ZodConfigValidator.js";
import { exampleDefinition } from "./config-core-test-fixtures.js";

describe("ConfigSchemaValidator", () => {
  it("throws schema-aware validation errors", () => {
    const loader = new ConfigLoader(new ZodConfigValidator(exampleDefinition), new YamlConfigDocumentParser());

    expect(() =>
      loader.validateParsed({
        format: "json",
        value: { mode: "strict" },
      }),
    ).toThrow(ConfigValidationError);
  });

  it("validates object requireAtLeastOneField constraints", () => {
    const validator = new ConfigSchemaValidator(
      new ConfigSchemaDefinitionDto({
        metadata: testMetadata,
        rootSchema: configSchema.strictObject(
          {
            steps: configSchema.optional(configSchema.array(configSchema.unknown())),
            tasks: configSchema.optional(configSchema.array(configSchema.unknown())),
          },
          {
            requireAtLeastOneField: ["steps", "tasks"],
          },
        ),
      }),
    );

    expect(() =>
      validator.validate({
        format: "json",
        value: {
          steps: [],
          tasks: [],
        },
      }),
    ).toThrow(ConfigValidationError);

    expect(
      validator.validate({
        format: "json",
        value: {
          steps: [{ id: "build" }],
        },
      }).config,
    ).toEqual({
      steps: [{ id: "build" }],
    });
  });

  it("validates default array id uniqueness", () => {
    const validator = new ConfigSchemaValidator(
      new ConfigSchemaDefinitionDto({
        metadata: testMetadata,
        rootSchema: configSchema.strictObject({
          steps: configSchema.array(
            configSchema.strictObject({
              id: configSchema.string(),
            }),
          ),
        }),
      }),
    );

    expect(() =>
      validator.validate({
        format: "json",
        value: {
          steps: [{ id: "build" }, { id: "build" }],
        },
      }),
    ).toThrow(ConfigValidationError);
  });

  it("validates additional array uniqueFields constraints", () => {
    const validator = new ConfigSchemaValidator(
      new ConfigSchemaDefinitionDto({
        metadata: testMetadata,
        rootSchema: configSchema.strictObject({
          steps: configSchema.array(
            configSchema.strictObject({
              id: configSchema.string(),
              name: configSchema.string(),
            }),
            {
              uniqueFields: ["name"],
            },
          ),
        }),
      }),
    );

    expect(() =>
      validator.validate({
        format: "json",
        value: {
          steps: [
            { id: "build", name: "Build" },
            { id: "test", name: "Build" },
          ],
        },
      }),
    ).toThrow(ConfigValidationError);
  });
});

const testMetadata = new ConfigSchemaMetadataDto({
  kind: "test.config",
  schemaId: "https://openstrap.dev/schemas/test.schema.json",
  title: "Test config",
  description: "Test config",
  filePatterns: [],
});
