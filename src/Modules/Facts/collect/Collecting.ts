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
    // A caller that named no sections has not said what it cares about, so nothing is filtered out.
    // Written this way rather than against a list of every section there is: such a list is a copy of
    // the model kept by hand, and the day a section is added to one and not the other it stops being
    // collected without anyone noticing.
    const listed = declaration.sections === undefined ? undefined : new Set(declaration.sections);
    const wanted = (section: string): boolean => listed === undefined || listed.has(section);
    const scalars = await this.system.read(wanted);
    const tools = wanted("tools") || wanted("runtimes")
      ? await this.tools.tools(declaration.tools ?? {})
      : {};

    return {
      ...scalars,
      ...(scalars.packages === undefined ? {} : {
        packages: { ...scalars.packages, installed: this.packages.packages(declaration.packages ?? {}) },
      }),
      users: wanted("users") ? this.accounts.accounts(declaration.users ?? {}) : {},
      groups: wanted("groups") ? this.accounts.members(declaration.groups ?? {}) : {},
      services: wanted("services") ? await this.services.services(declaration.services ?? {}) : {},
      paths: wanted("paths") ? this.paths.paths(declaration.paths ?? {}) : {},
      artifacts: wanted("artifacts") ? this.paths.artifacts(declaration.artifacts ?? {}) : {},
      commands: wanted("commands") ? await this.commands.commands(declaration.commands ?? {}) : {},
      env: wanted("env") ? this.commands.env(declaration.env ?? {}) : {},
      processes: wanted("processes") ? await this.processes.processes(declaration.processes ?? {}) : {},
      tools: wanted("tools") ? tools : {},
      runtimes: wanted("runtimes") ? this.tools.runtimes(tools) : {},
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
}
