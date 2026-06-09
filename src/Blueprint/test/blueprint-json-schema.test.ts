import { describe, expect, it } from "vitest";

import { BlueprintJsonSchema } from "../Schema/index.js";

describe("Blueprint JSON Schema", () => {
  it("emits the OpenStrap blueprint schema artifact", () => {
    const schema = new BlueprintJsonSchema().emit();

    expect(schema.$id).toBe("https://openstrap.dev/schemas/openstrap-blueprint.schema.json");
    expect(schema.title).toBe("OpenStrap blueprint");
  });
});
