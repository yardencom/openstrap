import { describe, expect, it } from "vitest";

import { PackageFacts } from "./PackageFacts.js";

const facts = new PackageFacts();

describe("packages", () => {
  it("says openstrap did not look rather than that the package is missing", async () => {
    const section = await facts.packages({ openssl: { names: ["openssl"], manager: "auto" } });

    expect(section!.installed).toEqual({
      openssl: {
        status: "unsupported",
        name: "openssl",
        manager: "auto",
        reason: "installed_packages_not_read",
      },
    });
  });

  it("answers every name a declaration lists", async () => {
    const section = await facts.packages({ tools: { names: ["npm", "uv"] } });

    expect(Object.keys(section!.installed!)).toEqual(["tools.npm", "tools.uv"]);
  });

  it("reports the package managers this machine has", async () => {
    const section = await facts.packages({});

    // Which managers are here depends on the machine; what does not is that every entry is present,
    // because a manager is in this section when its driving executable resolves on PATH.
    expect(Object.values(section!.managers).every((manager) => manager.status === "present")).toBe(true);
  });

  it("says nothing at all when nobody asked about packages", async () => {
    expect(await facts.packages(undefined)).toBeUndefined();
  });
});
