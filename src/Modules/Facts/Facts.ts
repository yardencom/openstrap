import { FactSnapshot } from "./domain/FactSnapshot.js";
import type { FactDeclaration } from "./domain/FactDeclaration.js";
import type { FactOrder } from "./domain/FactOrder.js";
import type { FactData, ToolFact, TransportFact } from "./domain/FactModel.js";
import { AccountFacts } from "./collect/accounts/AccountFacts.js";
import { CommandFacts } from "./collect/commands/CommandFacts.js";
import { PackageFacts } from "./collect/packages/PackageFacts.js";
import { PathFacts } from "./collect/paths/PathFacts.js";
import { Platform } from "./collect/platform/Platform.js";
import { ProcessFacts } from "./collect/processes/ProcessFacts.js";
import { ServiceFacts } from "./collect/services/ServiceFacts.js";
import { SystemFacts } from "./collect/system/SystemFacts.js";
import { ToolFacts } from "./collect/tools/ToolFacts.js";

/**
 * What a caller has to name and handle to use this module.
 *
 * Re-exported here rather than reached for in `Domain/`, so the module has one door: the class that
 * collects, the order it takes and the snapshot it gives back.
 */
export type { FactOrder, FactChannel } from "./domain/FactOrder.js";
export type { FactTarget } from "./domain/FactTarget.js";
export type { FactDeclaration } from "./domain/FactDeclaration.js";
// A type and not the class: a snapshot a caller assembled out of whatever it liked would be a
// snapshot nothing else in openstrap is entitled to trust.
export type { FactSnapshot } from "./domain/FactSnapshot.js";

/** A section a caller can name things in. */
type DeclaredSection = Exclude<keyof FactDeclaration, "sections">;

/**
 * Facts about the machine this is running on.
 *
 * The only way in, and there is one way to collect: openstrap reads the machine it is on. It is not
 * told where that is and has nothing to decide about it — no local case and no remote case, because a
 * machine openstrap is not on is read by openstrap being put there and asked the same question. That
 * is what makes two snapshots comparable: not agreement between two implementations, but the absence
 * of a second one.
 *
 * Every value comes from an API — systeminformation, `node:os`, `node:fs`, PATH resolution — and
 * never from openstrap parsing the output of a program it chose to run. The two exceptions are stated
 * where they are made: whether `sudo` runs without a password, and programs the caller declared.
 *
 * Collecting is a method rather than a constructor because reading waits, and a constructor cannot.
 */
export class Facts {
  private readonly platform = Platform.current();
  private readonly system = new SystemFacts(this.platform);
  private readonly accounts = new AccountFacts(this.platform);
  private readonly processes = new ProcessFacts(this.platform);
  private readonly services = new ServiceFacts(this.platform);
  private readonly tools = new ToolFacts(this.platform);
  private readonly packages = new PackageFacts();
  private readonly paths = new PathFacts(this.platform);
  private readonly commands = new CommandFacts(this.platform);

  /** Reads this machine and returns one snapshot of it. */
  async collect(order: FactOrder): Promise<FactSnapshot> {
    const data = await this.read(order.declare ?? {});

    // The moment is taken here, because this is what waited for the machine to answer.
    return new FactSnapshot(
      order.target,
      { ...data, transports: this.transports(order) },
      order.now ?? new Date(),
    );
  }

  private async read(declaration: FactDeclaration): Promise<FactData> {
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
      transports: {},
    };
  }

  /**
   * The `transports` section: the channel this snapshot was read through, when there was one.
   *
   * Nothing on a machine can answer this — a machine does not know how anyone got in — so it is
   * recorded only when whoever opened the channel says so. It matters because a requirement can be
   * written about the channel itself.
   *
   * Nothing is invented here. openstrap reading the machine it is on opened nothing, so it names
   * nothing; a `local` transport written in anyway was an invention, and a requirement about a
   * `local` transport was passing against exactly that.
   */
  private transports(order: FactOrder): Record<string, TransportFact> {
    if (order.channel === undefined) {
      return {};
    }

    return {
      [order.channel.type]: {
        status: "present",
        type: order.channel.type,
        ready: true,
        authMethods: order.channel.authMethods === undefined ? undefined : [...order.channel.authMethods],
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
