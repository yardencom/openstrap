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
      // Nothing declared is nothing to answer: every section below is made of the names it was
      // given, so an empty declaration produces an empty section without being asked about first.
      packages: { ...scalars.packages, installed: this.packages.packages(declaration.packages ?? {}) },
      users: this.accounts.accounts(declaration.users ?? {}),
      groups: this.accounts.members(declaration.groups ?? {}),
      services: await this.services.services(declaration.services ?? {}),
      paths: this.paths.paths(declaration.paths ?? {}),
      artifacts: this.paths.artifacts(declaration.artifacts ?? {}),
      commands: await this.commands.commands(declaration.commands ?? {}),
      env: this.commands.env(declaration.env ?? {}),
      // These three are the ones that answer without being given a name — the process table, the
      // tools a machine has anyway, and the runtimes those turn out to be — so these are the ones
      // there is something to ask about.
      processes: this.asked(declaration, "processes")
        ? await this.processes.processes(declaration.processes ?? {})
        : {},
      tools: this.asked(declaration, "tools") ? tools : {},
      runtimes: this.asked(declaration, "runtimes") ? this.tools.runtimes(tools) : {},
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
    if (!this.asked(declaration, "tools") && !this.asked(declaration, "runtimes")) {
      return {};
    }

    return this.tools.tools(declaration.tools ?? {});
  }

  /**
   * Whether a caller asked about a section that answers without being given a name.
   *
   * Only three sections have anything to ask about. Every other one is made of the names it was
   * given, so a caller that named nothing gets nothing whether it is asked about or not — the check
   * used to be written out for all of them and could not change a single answer.
   *
   * Three ways of asking, and they are one question. Naming something in the section asks for it — a
   * caller that declares a process should not also have to list `processes`. Listing the section by
   * name asks for it. And naming no sections at all asks for every one of them, because a caller that
   * has not said what it cares about is worse served by a missing fact than by an extra one.
   *
   * `runtimes` can only be asked for the last two ways: nothing can be named in it, because runtimes
   * are what the tools turned out to be rather than something to look up.
   */
  private asked(declaration: FactDeclaration, section: DeclaredSection | "runtimes"): boolean {
    const named = section === "runtimes" ? undefined : declaration[section];

    return Object.keys(named ?? {}).length > 0
      || declaration.sections === undefined
      || declaration.sections.includes(section);
  }
}
