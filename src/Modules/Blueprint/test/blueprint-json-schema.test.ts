import { describe, expect, it } from "vitest";

import { ConfigCore } from "../../../ConfigCore/index.js";
import { BlueprintSchema } from "../Schema/BlueprintSchema.js";

describe("Blueprint JSON Schema", () => {
  it("emits the OpenStrap blueprint schema artifact", () => {
    const configCore = new ConfigCore();
    const schema = configCore.emitJsonSchema(new BlueprintSchema(configCore.schema));

    expect(schema.$id).toBe("https://openstrap.dev/schemas/openstrap-blueprint.schema.json");
    expect(schema.title).toBe("OpenStrap blueprint");
  });
});
