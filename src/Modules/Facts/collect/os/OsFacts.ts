import type { Asked } from "#types/FactDeclaration.js";
import { readFileSync } from "node:fs";

import si from "systeminformation";

import type { FactSections } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

/** Which operating system this is. */
export class OsFacts {
  constructor(private readonly platform: Platform) {}

  /** @param declared What the order says about this section, or nothing when it did not ask for it. */
  async os(declared: Asked | undefined): Promise<FactSections["os"]> {
    if (declared === undefined) {
      return undefined;
    }

    return this.operatingSystem(await si.osInfo());
  }

/** Which operating system this is, in the spelling a requirement is written in. */
  private operatingSystem(reported: si.Systeminformation.OsData): FactSections["os"] {
    const declared = this.platform.is("linux") ? OsFacts.osRelease() : new Map<string, string>();
    const pretty = declared.get("PRETTY_NAME") ?? `${reported.distro} ${reported.release}`.trim();

    return {
      family: this.platform.name,
      // Lowercased because a requirement is written against an identifier —
      // `ubuntu` — not against the name a distribution prints on a banner.
      name: this.platform.is("macos") ? "macos" : declared.get("ID") ?? reported.distro.toLowerCase(),
      // Rolling distributions ship no VERSION_ID, so BUILD_ID answers for them.
      version: declared.get("VERSION_ID") ?? declared.get("BUILD_ID") ?? reported.release,
      codename: declared.get("VERSION_CODENAME") ?? OsFacts.named(reported.codename),
      kernel: reported.kernel,
      display: { pretty },
    };
  }

  /** What the distribution says it is. */
  private static osRelease(): Map<string, string> {
    const declared = new Map<string, string>();
    let content: string;

    try {
      content = readFileSync("/etc/os-release", "utf8");
    } catch {
      return declared;
    }

    for (const line of content.split("\n")) {
      const separator = line.indexOf("=");

      if (separator <= 0) {
        continue;
      }

      const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

      if (value !== "") {
        declared.set(line.slice(0, separator).trim(), value);
      }
    }

    return declared;
  }

  private static named(reported: string | undefined): string | undefined {
    const value = (reported ?? "").trim();

    return value === "" || value === "-" ? undefined : value;
  }
}

/** A name a tool actually reported, or nothing: a placeholder like `-` reads like an answer. */
