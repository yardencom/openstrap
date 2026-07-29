import { createHash } from "node:crypto";
import { accessSync, constants, lstatSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

import type {
  ArtifactDeclaration,
  PathDeclaration,
  PathRequirement,
} from "../../domain/FactDeclaration.js";
import type { ArtifactFact, PathFact } from "../../domain/FactModel.js";
import type { Platform } from "../platform/Platform.js";
import { Redaction } from "../redaction/Redaction.js";

/** How much of an artifact is kept when the caller asks for its content. */
const contentLimitBytes = 1024 * 1024;

/**
 * What is at each path the caller named.
 *
 * The paths arrive named — `{ workspace: "/src/app" }` — and the facts come back
 * under those names: a requirement asks whether `workspace` is writable, never
 * whether `/src/app` is. The path that was actually inspected travels inside the
 * fact, so a reader can still see what was looked at.
 *
 * A path that is not there is an answer, not a failure. A path that is there but
 * fails what the caller required of it is an error, because the caller said what
 * would make it acceptable and it is not.
 */
export class PathFacts {
  constructor(private readonly platform: Platform) {}

  paths(declared: Record<string, PathDeclaration> | undefined): Record<string, PathFact> {
    if (declared === undefined) {
      return {};
    }

    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      if (!this.platform.matches(declaration.platforms)) {
        return [id, { status: "unsupported" as const, path: declaration.path, reason: "platform_not_selected" }];
      }

      return [id, this.path(this.expanded(declaration.path), declaration.require)];
    }));
  }

  artifacts(declared: Record<string, ArtifactDeclaration> | undefined): Record<string, ArtifactFact> {
    if (declared === undefined) {
      return {};
    }

    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      if (!this.platform.matches(declaration.platforms)) {
        return [id, { status: "unsupported" as const, path: declaration.path, reason: "platform_not_selected" }];
      }

      return [id, this.artifact(declaration)];
    }));
  }

  /**
   * A path expanded the way the machine being read would expand it.
   *
   * `$HOME` means the home directory of the account this reading runs as, which
   * is why it is expanded here and not by whoever wrote the declaration: on a
   * guest that is a different account on a different machine.
   */
  private expanded(path: string): string {
    for (const prefix of ["$HOME", "~"]) {
      if (path === prefix) {
        return homedir();
      }

      if (path.startsWith(`${prefix}/`)) {
        return `${homedir()}${path.slice(prefix.length)}`;
      }
    }

    return path;
  }

  private path(path: string, required: readonly PathRequirement[] | undefined): PathFact {
    const entry = this.entry(path);

    if (entry === undefined) {
      return this.checked({ status: "absent", path, exists: false, reason: "path_not_found" }, required);
    }

    return this.checked({
      status: "present",
      path,
      exists: true,
      type: entry.type,
      readable: this.accessible(path, constants.R_OK),
      writable: this.accessible(path, constants.W_OK),
      executable: this.accessible(path, constants.X_OK),
      sizeBytes: entry.sizeBytes,
      mode: entry.mode,
    }, required);
  }

  /**
   * What the path is, following links.
   *
   * A symlink to a directory is the directory as far as anyone asking "is my
   * cache directory there" is concerned. A link whose target is gone is still an
   * entry on the disk, so it reads as a symlink rather than as nothing: calling
   * a broken link "absent" would hide it behind a fact that looks like empty
   * space.
   */
  private entry(path: string): { type: string; sizeBytes: number; mode: string } | undefined {
    try {
      const stat = statSync(path);

      return {
        type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
        sizeBytes: stat.size,
        mode: (stat.mode & 0o777).toString(8).padStart(3, "0"),
      };
    } catch {
      try {
        const link = lstatSync(path);

        return {
          type: "symlink",
          sizeBytes: link.size,
          mode: (link.mode & 0o777).toString(8).padStart(3, "0"),
        };
      } catch {
        return undefined;
      }
    }
  }

  private checked(fact: PathFact, required: readonly PathRequirement[] | undefined): PathFact {
    if (required === undefined || required.length === 0 || this.satisfies(fact, required)) {
      return fact;
    }

    return { ...fact, status: "error", reason: "path_requirements_not_satisfied" };
  }

  private satisfies(fact: PathFact, required: readonly PathRequirement[]): boolean {
    return required.every((requirement) => {
      switch (requirement) {
        case "exists":
          return fact.exists === true;
        case "absent":
          return fact.exists === false;
        case "file":
          return fact.type === "file";
        case "directory":
          return fact.type === "directory";
        case "readable":
          return fact.readable === true;
        case "writable":
          return fact.writable === true;
        case "executable":
          return fact.executable === true;
      }
    });
  }

  private artifact(declaration: ArtifactDeclaration): ArtifactFact {
    const path = this.expanded(declaration.path);
    const entry = this.entry(path);

    if (entry === undefined) {
      return {
        status: "absent",
        path,
        kind: declaration.kind,
        reason: "artifact_path_not_found",
      };
    }

    const found: ArtifactFact = {
      status: "present",
      path,
      kind: declaration.kind,
      type: entry.type,
      sizeBytes: entry.sizeBytes,
    };

    if (declaration.capture === undefined || declaration.capture === "metadata") {
      return found;
    }

    if (entry.type !== "file") {
      return { ...found, reason: `${declaration.capture}_requires_a_file` };
    }

    return declaration.capture === "hash"
      ? this.hashed(found)
      : this.captured(found, declaration);
  }

  private hashed(found: ArtifactFact): ArtifactFact {
    try {
      return { ...found, sha256: createHash("sha256").update(readFileSync(found.path)).digest("hex") };
    } catch {
      return { ...found, status: "error", reason: "artifact_not_readable" };
    }
  }

  /**
   * The artifact itself, up to a limit.
   *
   * A snapshot is meant to be read and compared, so an unbounded file would make
   * it unusable. Truncation is recorded rather than silent: a reader has to be
   * able to tell a short file from a shortened one.
   */
  private captured(found: ArtifactFact, declaration: ArtifactDeclaration): ArtifactFact {
    let content: string;

    try {
      content = readFileSync(found.path, "utf8");
    } catch {
      return { ...found, status: "error", reason: "artifact_not_readable" };
    }

    const truncated = Buffer.byteLength(content, "utf8") > contentLimitBytes;

    return {
      ...found,
      content: new Redaction(declaration.redaction).apply(truncated ? content.slice(0, contentLimitBytes) : content),
      reason: truncated ? "artifact_content_truncated" : undefined,
    };
  }

  private accessible(path: string, mode: number): boolean {
    try {
      accessSync(path, mode);

      return true;
    } catch {
      return false;
    }
  }
}
