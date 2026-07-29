import si from "systeminformation";
import which from "which";

import type { ToolDeclaration } from "../../domain/FactDeclaration.js";
import type { RuntimeFact, ToolFact } from "../../domain/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/**
 * The tools almost every blueprint asks about.
 *
 * A caller that cares about something else says so; a caller that does not
 * should not have to spell out the obvious.
 */
const commonTools: readonly string[] = ["node", "npm", "python3", "git"];

/** Tools whose presence makes a runtime available to a blueprint. */
const runtimeTools: readonly string[] = ["node", "python3"];

/**
 * Tool names that systeminformation knows a version query for under another
 * spelling. Without the alias `python3` would read as present with no version.
 */
const versionAliases: Record<string, string> = {
  python3: "python",
};

/** Which programs are installed, and the runtimes that follow from them. */
export class ToolFacts {
  constructor(private readonly platform: Platform) {}

  /**
   * Where each tool asked about is, and what version it reports.
   *
   * The path comes from resolving the name on PATH, which is what "installed"
   * means to anything about to run it. The version comes from an API when there
   * is one for that tool; when there is not, the tool is still reported present
   * with no version rather than being run to see what it says about itself.
   */
  private lookup?: Promise<Record<string, ToolFact>>;

  async tools(declared: Record<string, ToolDeclaration> | undefined): Promise<Record<string, ToolFact>> {
    if (declared === undefined) {
      return {};
    }

    return this.looked(declared);
  }

  /**
   * Which runtimes a blueprint can rely on.
   *
   * Asked for on its own, because a blueprint that wants "node 18 or later" is asking whether it can
   * run something, not where the binary lives. The tools are looked up once either way, so the two
   * sections cannot disagree about the same machine and neither pays for the other.
   */
  async runtimes(declared: Record<string, ToolDeclaration> | undefined): Promise<Record<string, RuntimeFact>> {
    if (declared === undefined) {
      return {};
    }

    return this.derived(await this.looked(declared));
  }

  /** The lookup, done once however many sections turn out to need it. */
  private looked(declared: Record<string, ToolDeclaration>): Promise<Record<string, ToolFact>> {
    this.lookup ??= this.look(declared);

    return this.lookup;
  }

  private async look(declared: Record<string, ToolDeclaration>): Promise<Record<string, ToolFact>> {

    const wanted = Object.keys(declared).length > 0
      ? Object.entries(declared).map(([id, declaration]) => ({ id, name: declaration.name ?? id, declaration }))
      : commonTools.map((name) => ({ id: name, name, declaration: {} as ToolDeclaration }));
    const versions = await si.versions(wanted.map((tool) => versionAliases[tool.name] ?? tool.name).join(","));
    const facts = await Promise.all(wanted.map(async (tool) => {
      if (!this.platform.matches(tool.declaration.platforms)) {
        return [tool.id, { status: "unsupported" as const, name: tool.name, reason: "platform_not_selected" }] as const;
      }

      const path = await which(tool.name, { nothrow: true });

      if (path === null) {
        return [tool.id, {
          status: "absent" as const,
          name: tool.name,
          executable: false,
        }] as const;
      }

      const reported = versions[(versionAliases[tool.name] ?? tool.name) as keyof typeof versions];

      return [tool.id, {
        status: "present" as const,
        name: tool.name,
        path,
        executable: true,
        version: typeof reported === "string" && reported !== "" ? reported : undefined,
      }] as const;
    }));

    return Object.fromEntries(facts);
  }

  /**
   * Which runtimes a blueprint can rely on.
   *
   * A runtime is a tool seen from the other side: a blueprint asking for "node
   * 18 or later" is asking whether it can run something, not where the binary
   * lives. Derived here rather than read again, so the two sections cannot
   * disagree about the same machine.
   */
  private derived(tools: Record<string, ToolFact>): Record<string, RuntimeFact> {
    return Object.fromEntries(
      Object.entries(tools)
        .filter(([name, tool]) => tool.status === "present" && runtimeTools.includes(tool.name ?? name))
        .map(([name, tool]) => [tool.name ?? name, {
          status: "present" as const,
          type: tool.name ?? name,
          version: tool.version,
          ready: true,
        }]),
    );
  }
}
