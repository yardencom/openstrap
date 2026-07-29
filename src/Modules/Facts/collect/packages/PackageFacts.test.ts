import { describe, expect, it } from "vitest";

import { PackageFacts } from "./PackageFacts.js";

const facts = new PackageFacts();

describe("installed packages", () => {
  it("says openstrap did not look rather than that the package is missing", () => {
    expect(facts.packages({ openssl: { names: ["openssl"], manager: "auto" } })).toEqual({
      openssl: {
        status: "unsupported",
        name: "openssl",
        manager: "auto",
        reason: "installed_packages_not_read",
      },
    });
  });

  it("answers every name a declaration lists", () => {
    expect(Object.keys(facts.packages({ tools: { names: ["npm", "uv"] } }))).toEqual(["tools.npm", "tools.uv"]);
  });
});
