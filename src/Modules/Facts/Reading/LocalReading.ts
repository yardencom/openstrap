import type { FactDeclaration } from "../Domain/FactDeclaration.js";
import type { FactData, ToolFact } from "../Domain/FactModel.js";
import { AccountFacts } from "./Local/AccountFacts.js";
import { CommandFacts } from "./Local/CommandFacts.js";
import { EntityFacts } from "./Local/EntityFacts.js";
import { PathFacts } from "./Local/PathFacts.js";
import { Platform } from "./Local/Platform.js";
import { SystemFacts } from "./Local/SystemFacts.js";
import type { SystemReading } from "./SystemReading.js";

/** A section a caller can name things in. */
type DeclaredSection = Exclude<keyof FactDeclaration, "sections">;

/**
 * Reading the machine this process is running on.
 *
 * This is the whole of openstrap's fact collection. Reading a guest is the same
 * code running on the guest, which is why a host snapshot and a guest snapshot
 * are comparable at all: there is no second implementation to drift.
 *
 * Every value comes from an API — systeminformation, `node:os`, `node:fs`, PATH
 * resolution — and never from openstrap parsing the output of a program it chose
 * to run. The two exceptions are stated where they are made: whether `sudo` runs
 * without a password, and programs the caller explicitly declared.
 */
export class LocalReading implements SystemReading {
  private readonly platform = Platform.current();
  private readonly system = new SystemFacts(this.platform);
  private readonly entities = new EntityFacts(this.platform);
  private readonly paths = new PathFacts(this.platform);
  private readonly commands = new CommandFacts(this.platform);
  private readonly accounts = new AccountFacts(this.platform);

  async read(declaration: FactDeclaration = {}): Promise<FactData> {
    const scalars = await this.system.read();
    const tools = await this.readTools(declaration);

    return {
      ...scalars,
      packages: {
        ...scalars.packages,
        installed: this.entities.packages(this.wanted(declaration, "packages") ? declaration.packages ?? {} : {}),
      },
      users: this.accounts.accounts(this.wanted(declaration, "users") ? declaration.users ?? {} : {}),
      groups: this.wanted(declaration, "groups") ? this.accounts.members(declaration.groups ?? {}) : {},
      processes: this.wanted(declaration, "processes")
        ? await this.entities.processes(declaration.processes ?? {})
        : {},
      services: this.wanted(declaration, "services")
        ? await this.entities.services(declaration.services ?? {})
        : {},
      tools: this.wanted(declaration, "tools") ? tools : {},
      runtimes: this.entities.runtimes(tools),
      paths: this.wanted(declaration, "paths") ? this.paths.paths(declaration.paths ?? {}) : {},
      artifacts: this.wanted(declaration, "artifacts") ? this.paths.artifacts(declaration.artifacts ?? {}) : {},
      commands: this.wanted(declaration, "commands") ? await this.commands.commands(declaration.commands ?? {}) : {},
      env: this.wanted(declaration, "env") ? this.commands.env(declaration.env ?? {}) : {},
      // Which channel reached this machine is known by whoever opened it, not by
      // the machine, so the reading leaves it to the caller to record.
      transports: {},
    };
  }

  /**
   * Tools, read once for two sections.
   *
   * Runtimes are tools seen from the other side, so asking for either asks for
   * the same lookup. Doing it once means the two sections cannot disagree.
   */
  private async readTools(declaration: FactDeclaration): Promise<Record<string, ToolFact>> {
    if (!this.wanted(declaration, "tools") && !this.requested(declaration, "runtimes")) {
      return {};
    }

    return this.entities.tools(declaration.tools ?? {});
  }

  /**
   * Whether a section was asked for.
   *
   * Naming something in a section is itself a request for it — a caller that
   * declares a process should not also have to list `processes`.
   */
  private wanted(declaration: FactDeclaration, section: DeclaredSection): boolean {
    return Object.keys(declaration[section] ?? {}).length > 0 || this.requested(declaration, section);
  }

  /**
   * Whether a caller listed a section by name.
   *
   * A caller that names no sections at all gets everything, because it has not
   * said what it cares about and the cheapest wrong answer is a missing fact.
   */
  private requested(declaration: FactDeclaration, section: string): boolean {
    return declaration.sections === undefined || declaration.sections.includes(section);
  }
}
