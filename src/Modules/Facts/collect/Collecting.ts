import type { FactDeclaration } from "../domain/FactDeclaration.js";
import type { FactChannel, FactOrder } from "../domain/FactOrder.js";
import type { FactSections, ToolFact, TransportFact } from "../domain/FactModel.js";
import { AccountFacts } from "./accounts/AccountFacts.js";
import { CommandFacts } from "./commands/CommandFacts.js";
import { PackageFacts } from "./packages/PackageFacts.js";
import { PathFacts } from "./paths/PathFacts.js";
import { Platform } from "./platform/Platform.js";
import { ProcessFacts } from "./processes/ProcessFacts.js";
import { ServiceFacts } from "./services/ServiceFacts.js";
import { SystemFacts } from "./system/SystemFacts.js";
import { ToolFacts } from "./tools/ToolFacts.js";

/** A section a caller can name things in. */
type DeclaredSection = Exclude<keyof FactDeclaration, "sections">;

/**
 * One reading of a machine, section by section.
 *
 * Apart from the facts themselves because collecting is work and facts are an answer: this holds the
 * collectors and the decisions about what was asked for, and stops existing the moment it has
 * produced a set of sections.
 */
export class Collecting {
  private readonly platform = Platform.current();
  private readonly system = new SystemFacts(this.platform);
  private readonly accounts = new AccountFacts(this.platform);
  private readonly processes = new ProcessFacts(this.platform);
  private readonly services = new ServiceFacts(this.platform);
  private readonly tools = new ToolFacts(this.platform);
  private readonly packages = new PackageFacts();
  private readonly paths = new PathFacts(this.platform);
  private readonly commands = new CommandFacts(this.platform);

  async read(request: FactOrder): Promise<FactSections> {
    const declaration = request.declare ?? {};
    const scalars = await this.system.read();
    const tools = await this.readTools(declaration);

    return {
      ...scalars,
      packages: {
        ...scalars.packages,
        installed: this.packages.packages(this.wanted(declaration, "packages") ? declaration.packages ?? {} : {}),
      },
      users: this.accounts.accounts(this.wanted(declaration, "users") ? declaration.users ?? {} : {}),
      groups: this.wanted(declaration, "groups") ? this.accounts.members(declaration.groups ?? {}) : {},
      processes: this.wanted(declaration, "processes")
        ? await this.processes.processes(declaration.processes ?? {})
        : {},
      services: this.wanted(declaration, "services")
        ? await this.services.services(declaration.services ?? {})
        : {},
      tools: this.wanted(declaration, "tools") ? tools : {},
      runtimes: this.tools.runtimes(tools),
      paths: this.wanted(declaration, "paths") ? this.paths.paths(declaration.paths ?? {}) : {},
      artifacts: this.wanted(declaration, "artifacts") ? this.paths.artifacts(declaration.artifacts ?? {}) : {},
      commands: this.wanted(declaration, "commands") ? await this.commands.commands(declaration.commands ?? {}) : {},
      env: this.wanted(declaration, "env") ? this.commands.env(declaration.env ?? {}) : {},
      transports: this.transports(request.channel),
    };
  }

  /**
   * The `transports` section: the channel these facts were read through, when there was one.
   *
   * Nothing on a machine can answer this — a machine does not know how anyone got in — so it is
   * recorded only when whoever opened the channel says so. It matters because a requirement can be
   * written about the channel itself.
   *
   * Nothing is invented. openstrap reading the machine it is on opened nothing, so it names nothing;
   * a `local` transport written in anyway was an invention, and a requirement about a `local`
   * transport was passing against exactly that.
   */
  private transports(channel: FactChannel | undefined): Record<string, TransportFact> {
    if (channel === undefined) {
      return {};
    }

    return {
      [channel.type]: {
        status: "present",
        type: channel.type,
        ready: true,
        authMethods: channel.authMethods === undefined ? undefined : [...channel.authMethods],
      },
    };
  }

  /**
   * Tools, read once for two sections.
   *
   * Runtimes are tools seen from the other side, so asking for either asks for the same lookup. Doing
   * it once means the two sections cannot disagree.
   */
  private async readTools(declaration: FactDeclaration): Promise<Record<string, ToolFact>> {
    if (!this.wanted(declaration, "tools") && !this.requested(declaration, "runtimes")) {
      return {};
    }

    return this.tools.tools(declaration.tools ?? {});
  }

  /**
   * Whether a section was asked for.
   *
   * Naming something in a section is itself a request for it — a caller that declares a process
   * should not also have to list `processes`.
   */
  private wanted(declaration: FactDeclaration, section: DeclaredSection): boolean {
    return Object.keys(declaration[section] ?? {}).length > 0 || this.requested(declaration, section);
  }

  /**
   * Whether a caller listed a section by name.
   *
   * A caller that names no sections at all gets everything, because it has not said what it cares
   * about and the cheapest wrong answer is a missing fact.
   */
  private requested(declaration: FactDeclaration, section: string): boolean {
    return declaration.sections === undefined || declaration.sections.includes(section);
  }
}
