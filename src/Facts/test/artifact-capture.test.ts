import { describe, expect, it } from "vitest";

import { ArtifactCapture } from "../Definition/Domain/ValueObjects/ArtifactCapture.js";

describe("ArtifactCapture", () => {
  it("exposes stable YAML values through a domain enum", () => {
    expect(ArtifactCapture.Metadata).toBe("metadata");
    expect(ArtifactCapture.Hash).toBe("hash");
    expect(ArtifactCapture.Content).toBe("content");
  });
});
