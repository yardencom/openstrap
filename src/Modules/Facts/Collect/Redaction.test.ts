import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { Redaction } from "./Redaction.js";

const secret = "token=abc123 user=ada";

describe("Redaction", () => {
  it("leaves output alone when nothing was asked for", () => {
    expect(new Redaction(undefined).apply(secret)).toBe(secret);
    expect(new Redaction({ strategy: "none" }).apply(secret)).toBe(secret);
  });

  it("keeps nothing when asked to omit", () => {
    expect(new Redaction({ strategy: "omit" }).apply(secret)).toBe("");
  });

  it("keeps a digest when asked to hash, so two runs can still be compared", () => {
    const hashed = new Redaction({ strategy: "hash" }).apply(secret);

    expect(hashed).toBe(createHash("sha256").update(secret).digest("hex"));
    expect(new Redaction({ strategy: "hash" }).apply("something else")).not.toBe(hashed);
  });

  it("masks every occurrence of every pattern", () => {
    const masked = new Redaction({ strategy: "mask", patterns: ["token=\\S+"] }).apply(`${secret} ${secret}`);

    expect(masked).toBe("[masked] user=ada [masked] user=ada");
  });

  it("withholds everything when masking was asked for with nothing to match", () => {
    expect(new Redaction({ strategy: "mask" }).apply(secret)).toBe("[masked]");
    expect(new Redaction({ strategy: "mask", patterns: [] }).apply(secret)).toBe("[masked]");
  });

  it("says whether anything was withheld", () => {
    expect(new Redaction(undefined).redacted).toBe(false);
    expect(new Redaction({ strategy: "none" }).redacted).toBe(false);
    expect(new Redaction({ strategy: "mask" }).redacted).toBe(true);
  });
});
