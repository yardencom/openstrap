import { describe, expect, it } from "vitest";

import { FactImportance } from "../Domain/ValueObjects/FactImportance.js";
import { FactPlatform } from "../Domain/ValueObjects/FactPlatform.js";
import { FileRequirement } from "../Domain/ValueObjects/FileRequirement.js";
import { RedactionStrategy } from "../Domain/ValueObjects/RedactionStrategy.js";
import { SessionKind } from "../Domain/ValueObjects/SessionKind.js";

describe("FactsConfig value objects", () => {
  it("uses domain enums for fact importance", () => {
    expect(FactImportance.Required).toBe("required");
    expect(FactImportance.Optional).toBe("optional");
    expect(FactImportance.Evidence).toBe("evidence");
  });

  it("uses domain enums for platforms", () => {
    expect(FactPlatform.Linux).toBe("linux");
    expect(FactPlatform.Macos).toBe("macos");
    expect(FactPlatform.Windows).toBe("windows");
    expect(FactPlatform.Posix).toBe("posix");
  });

  it("uses domain enums for redaction strategies", () => {
    expect(RedactionStrategy.None).toBe("none");
    expect(RedactionStrategy.Mask).toBe("mask");
    expect(RedactionStrategy.Hash).toBe("hash");
    expect(RedactionStrategy.Omit).toBe("omit");
  });

  it("uses domain enums for file requirements", () => {
    expect(FileRequirement.Exists).toBe("exists");
    expect(FileRequirement.Directory).toBe("directory");
    expect(FileRequirement.Executable).toBe("executable");
  });

  it("uses domain enums for session kinds", () => {
    expect(SessionKind.Interactive).toBe("interactive");
    expect(SessionKind.Login).toBe("login");
    expect(SessionKind.Ssh).toBe("ssh");
    expect(SessionKind.Terminal).toBe("terminal");
  });
});
