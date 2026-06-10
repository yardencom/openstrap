import { describe, expect, it } from "vitest";

import { FactDeclarationSection } from "../Definition/Domain/ValueObjects/FactDeclarationSection.js";

describe("FactDeclarationSection", () => {
  it("exposes stable YAML section names through a domain enum", () => {
    expect(FactDeclarationSection.Commands).toBe("commands");
    expect(FactDeclarationSection.Env).toBe("env");
    expect(FactDeclarationSection.Artifacts).toBe("artifacts");
  });
});
