import {
  ConfigCore,
  type ConfigDefinition,
} from "../index.js";

type ExampleConfig = {
  id: string;
  mode: "strict" | "loose";
  nested?: {
    capture: "metadata" | "content";
  };
};

export const exampleConfigCore = new ConfigCore();
const schema = exampleConfigCore.schema;

export const exampleDefinition: ConfigDefinition<ExampleConfig> = schema.define<ExampleConfig>({
  kind: "example.config",
  schemaId: "https://openstrap.dev/schemas/example.schema.json",
  title: "Example config",
  description: "Example reusable config schema",
  filePatterns: ["openstrap.example.yaml", ".openstrap/example.yaml"],
  rootSchema: schema.strictObject({
    id: schema.string({ minLength: 1 }),
    mode: schema.defaulted(schema.enum(["strict", "loose"]), "strict"),
    nested: schema.optional(
      schema.strictObject({
        capture: schema.defaulted(schema.enum(["metadata", "content"]), "metadata"),
      }),
    ),
  }),
});
