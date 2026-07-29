import { describe, expect, it } from "vitest";

import { ConfigCore } from "../index.js";
import { ConfigValidationError } from "../errors/ConfigValidationError.js";
import { exampleConfigCore, exampleDefinition } from "./config-core-test-fixtures.js";

describe("ConfigCore schema validation", () => {
  it("throws schema-aware validation errors", () => {
    expect(() =>
      exampleConfigCore.load(exampleDefinition, {
        content: `
mode: strict
`,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("validates object requireAtLeastOneField constraints", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject(
        {
          steps: schema.optional(schema.array(schema.unknown())),
          tasks: schema.optional(schema.array(schema.unknown())),
        },
        {
          requireAtLeastOneField: ["steps", "tasks"],
        },
      ),
    });

    expect(() =>
      configCore.load(definition, {
        content: `
steps: []
tasks: []
`,
      }),
    ).toThrow(ConfigValidationError);

    expect(
      configCore.load(definition, {
        content: `
steps:
  - id: build
`,
      }),
    ).toEqual({
      steps: [{ id: "build" }],
    });
  });

  it("validates object array uniqueBy fields", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject({
        steps: schema.array(
          schema.strictObject({
            id: schema.string(),
          }),
          {
            uniqueBy: ["id"],
          },
        ),
      }),
    });

    expect(() =>
      configCore.load(definition, {
        content: `
steps:
  - id: build
  - id: build
`,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("requires object arrays to declare uniqueBy fields", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;

    expect(() =>
      schema.array(
        schema.strictObject({
          id: schema.string(),
        }),
      ),
    ).toThrow(/uniqueBy/);
  });

  it("rejects uniqueBy for primitive arrays", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;

    expect(() =>
      schema.array(schema.string(), {
        uniqueBy: ["id"],
      }),
    ).toThrow(/uniqueBy/);
  });

  it("requires uniqueBy fields to exist on object array elements", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;

    expect(() =>
      schema.array(
        schema.strictObject({
          name: schema.string(),
        }),
        {
          uniqueBy: ["id"],
        },
      ),
    ).toThrow(/uniqueBy field/);
  });

  it("validates object array uniqueness for non-id fields", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject({
        steps: schema.array(
          schema.strictObject({
            id: schema.string(),
            name: schema.string(),
          }),
          {
            uniqueBy: ["name"],
          },
        ),
      }),
    });

    expect(() =>
      configCore.load(definition, {
        content: `
steps:
  - id: build
    name: Build
  - id: test
    name: Build
`,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("rejects object array items with missing uniqueBy values", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject({
        steps: schema.array(
          schema.strictObject({
            id: schema.optional(schema.string()),
            name: schema.string(),
          }),
          {
            uniqueBy: ["id"],
          },
        ),
      }),
    });

    expect(() =>
      configCore.load(definition, {
        content: `
steps:
  - name: Build
`,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("keeps object uniqueBy comparison type-aware", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject({
        steps: schema.array(
          schema.strictObject({
            id: schema.union<number | string>([
              schema.number(),
              schema.string(),
            ]),
          }),
          {
            uniqueBy: ["id"],
          },
        ),
      }),
    });

    expect(
      configCore.load(definition, {
        content: `
steps:
  - id: 1
  - id: "1"
`,
      }),
    ).toEqual({
      steps: [{ id: 1 }, { id: "1" }],
    });
  });

  it("validates primitive array uniqueness by default", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.strictObject({
        platforms: schema.array(schema.string()),
      }),
    });

    expect(() =>
      configCore.load(definition, {
        content: `
platforms:
  - linux
  - linux
`,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("requires discriminated union keys to match discriminator literals", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;

    expect(() =>
      schema.discriminatedUnion("kind", {
        command: schema.strictObject({
          kind: schema.literal("file"),
          path: schema.string(),
        }),
        file: schema.strictObject({
          kind: schema.literal("file"),
          path: schema.string(),
        }),
      }),
    ).toThrow(/discriminator/);
  });

  it("requires discriminated union variants to declare discriminator literals", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;

    expect(() =>
      schema.discriminatedUnion("kind", {
        command: schema.strictObject({
          name: schema.string(),
        }),
        file: schema.strictObject({
          kind: schema.literal("file"),
          path: schema.string(),
        }),
      }),
    ).toThrow(/discriminator/);
  });

  it("validates discriminated unions by discriminator field", () => {
    const configCore = new ConfigCore();
    const schema = configCore.schema;
    const definition = schema.define<any>({
      kind: "test.config",
      schemaId: "https://openstrap.dev/schemas/test.schema.json",
      title: "Test config",
      description: "Test config",
      rootSchema: schema.discriminatedUnion("kind", {
        command: schema.strictObject({
          kind: schema.literal("command"),
          name: schema.string(),
        }),
        file: schema.strictObject({
          kind: schema.literal("file"),
          path: schema.string(),
        }),
      }),
    });

    expect(
      configCore.load(definition, {
        content: `
kind: command
name: git
`,
      }),
    ).toEqual({
      kind: "command",
      name: "git",
    });

    expect(() =>
      configCore.load(definition, {
        content: `
kind: file
name: git
`,
      }),
    ).toThrow(ConfigValidationError);
  });
});
