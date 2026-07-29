import { existsSync, readFileSync } from "node:fs";

import si from "systeminformation";

import type { FactSections } from "../../domain/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/** Which operating system this is. */
export class OsFacts {
  constructor(private readonly platform: Platform) {}

  /** @param declared What the order says about this section, or nothing when it did not ask for it. */
  async os(declared: Record<string, never> | undefined): Promise<FactSections["os"]> {
    if (declared === undefined) {
      return undefined;
    }

    return this.operatingSystem(await si.osInfo());
  }

/**
   * Which operating system this is, in the spelling a requirement is written in.
   *
   * On Linux the answer comes from `/etc/os-release`, which is the distribution's
   * own declaration of its identity, because a requirement says `ubuntu 24.04`
   * and that file is the only place those exact strings exist. What a tool prints
   * for a human — `Ubuntu 24.04.4 LTS` — is kept beside them rather than instead
   * of them: comparing against a banner is how a version check starts failing on
   * a point release.
   *
   * macOS has no such file and needs none: the product version is already the
   * version anyone writes down.
   */
  private operatingSystem(reported: si.Systeminformation.OsData): FactSections["os"] {
    const declared = this.platform.is("linux") ? osRelease() : new Map<string, string>();
    const pretty = declared.get("PRETTY_NAME") ?? `${reported.distro} ${reported.release}`.trim();

    return {
      family: this.platform.name,
      // Lowercased because a requirement is written against an identifier —
      // `ubuntu` — not against the name a distribution prints on a banner.
      name: this.platform.is("macos") ? "macos" : declared.get("ID") ?? reported.distro.toLowerCase(),
      // Rolling distributions ship no VERSION_ID, so BUILD_ID answers for them.
      version: declared.get("VERSION_ID") ?? declared.get("BUILD_ID") ?? reported.release,
      codename: declared.get("VERSION_CODENAME") ?? named(reported.codename),
      kernel: reported.kernel,
      display: { pretty },
    };
  }
}

/**
 * What the distribution says it is.
 *
 * `/etc/os-release` is a shell fragment of `KEY=value` lines, quoted where the
 * value has spaces in it. It is read rather than sourced, because sourcing a file
 * runs it, and reading a fact must not run anything.
 */
function osRelease(): Map<string, string> {
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
/**
 * A name a tool actually reported, or nothing.
 *
 * Placeholders travel: `si` answers `-` for a cpu model a virtual machine does
 * not expose, and a snapshot saying the model is `-` is worse than one saying
 * nothing, because it reads like an answer.
 */
function named(reported: string | undefined): string | undefined {
  const value = (reported ?? "").trim();

  return value === "" || value === "-" ? undefined : value;
}
