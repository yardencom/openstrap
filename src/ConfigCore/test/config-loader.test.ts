import { describe, expect, it } from "vitest";

import { ConfigLoader } from "../index.js";
import { YamlConfigDocumentParser } from "../Adapters/YamlConfigDocumentParser.js";
import { ZodConfigValidator } from "../Adapters/ZodConfigValidator.js";
import { exampleDefinition } from "./config-core-test-fixtures.js";

describe("ConfigLoader", () => {
  it("loads YAML through parser and validator ports", () => {
    const loader = new ConfigLoader(new ZodConfigValidator(exampleDefinition), new YamlConfigDocumentParser());

    const document = loader.load({
      format: "yaml",
      content: `
id: sample
`,
    });

    expect(document.kind).toBe("example.config");
    expect(document.schemaId).toBe("https://openstrap.dev/schemas/example.schema.json");
    expect(document.config).toEqual({ id: "sample", mode: "strict" });
  });
});
