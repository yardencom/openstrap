import type { FactChannel } from "./domain/FactOrder.js";
import type { FactDeclaration } from "./domain/FactDeclaration.js";
import type { FactSections, ToolFact, TransportFact } from "./domain/FactModel.js";
import { AccountFacts } from "./collect/accounts/AccountFacts.js";
import { CommandFacts } from "./collect/commands/CommandFacts.js";
import { PackageFacts } from "./collect/packages/PackageFacts.js";
import { PathFacts } from "./collect/paths/PathFacts.js";
import { Platform } from "./collect/platform/Platform.js";
import { ProcessFacts } from "./collect/processes/ProcessFacts.js";
import { ServiceFacts } from "./collect/services/ServiceFacts.js";
import { SystemFacts } from "./collect/system/SystemFacts.js";
import { ToolFacts } from "./collect/tools/ToolFacts.js";

/** What a caller has to name to ask for facts. */
export type { FactOrder, FactChannel } from "./domain/FactOrder.js";
export type { FactTarget } from "./domain/FactTarget.js";
export type { FactDeclaration } from "./domain/FactDeclaration.js";
export type { FactSections } from "./domain/FactModel.js";

/** A section a caller can name things in. */
type DeclaredSection = Exclude<keyof FactDeclaration, "sections">;

/** Whether the collecting got everything it was asked for. */
export type FactsStatus = "success" | "warning" | "error";

/** What to collect, and what the caller knows that the machine cannot know about itself. */
export type FactsRequest = {
  declare?: FactDeclaration;
  channel?: FactChannel;
};

/**
 * The facts about the machine this is running on.
 *
 * One type, and it is the thing it is named after. `Facts.collect()` is the way in — it runs every
 * collector and hands back the facts — and what it hands back is an instance of this, not a bag of
 * sections somebody else has to make sense of. That matters because there is a question only the
 * facts can answer, whether everything asked for came back, and the answer has to live where the
 * sections are; it used to be worked out by whatever happened to be carrying them.
 *
 * There is one way to collect and it does not know where it is running. No local case and no remote
 * case: a machine openstrap is not on is read by openstrap being put there and asked this same
 * question. That is what makes two collections comparable — not agreement between two
 * implementations, but the absence of a second one.
 *
 * Every value comes from an API — systeminformation, `node:os`, `node:fs`, PATH resolution — and
 * never from openstrap parsing the output of a program it chose to run. The two exceptions are stated
 * where they are made: whether `sudo` runs without a password, and programs the caller declared.
 *
 * The sections are its own properties rather than something it wraps, so the facts and their JSON are
 * one shape: `facts.os.name` here is `facts.os.name` in the snapshot openstrap printed on another
 * machine, and requirements are written against one spelling. That is what the interface below is
 * for — it gives the class the sections in the type system, the constructor gives them at runtime,
 * and methods are not enumerable, so they never reach the JSON.
 */
export interface Facts extends FactSections {}

export class Facts {
  private constructor(sections: FactSections) {
    Object.assign(this, sections);

    freeze(this);
  }

  /**
   * Reads this machine.
   *
   * A method and not a constructor, because reading waits and a constructor cannot.
   */
  static async collect(request: FactsRequest = {}): Promise<Facts> {
    return new Facts(await new Collecting().read(request));
  }

  /**
   * Facts as they came back from JSON, which openstrap on another machine collected.
   *
   * They are not judged again here — openstrap collected them, and a second opinion would be a second
   * implementation — but they are made facts again, because text cannot answer for itself.
   */
  static of(sections: unknown): Facts {
    if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
      throw new TypeError("Not a set of fact sections");
    }

    return new Facts(sections as FactSections);
  }

  /**
   * Whether everything asked for came back.
   *
   * A machine that could not be read at all never gets this far — that is an exception. What is left
   * is a machine that answered, where some declared thing failed: a command that would not run, a
   * path that failed what was required of it, a user found under another id. The facts are still
   * usable, so it is a warning rather than a failure, and the reason sits on the section that failed.
   *
   * Found by walking the sections rather than by a list of them to look in. A list is a thing to
   * forget: `users` was added to the model and not to the list, and facts holding a failed user read
   * as a clean collection.
   */
  status(): FactsStatus {
    return statusOf({ ...this });
  }
}

/**
 * One reading of a machine, section by section.
 *
 * Apart from the facts themselves because collecting is work and facts are an answer: this holds the
 * collectors and the decisions about what was asked for, and stops existing the moment it has
 * produced a set of sections.
 */
class Collecting {
  private readonly platform = Platform.current();
  private readonly system = new SystemFacts(this.platform);
  private readonly accounts = new AccountFacts(this.platform);
  private readonly processes = new ProcessFacts(this.platform);
  private readonly services = new ServiceFacts(this.platform);
  private readonly tools = new ToolFacts(this.platform);
  private readonly packages = new PackageFacts();
  private readonly paths = new PathFacts(this.platform);
  private readonly commands = new CommandFacts(this.platform);

  async read(request: FactsRequest): Promise<FactSections> {
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

function statusOf(value: unknown): FactsStatus {
  if (!value || typeof value !== "object") {
    return "success";
  }

  if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
    return "warning";
  }

  return Object.values(value).some((property) => statusOf(property) === "warning") ? "warning" : "success";
}

function freeze(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  Object.freeze(value);

  for (const property of Object.values(value)) {
    freeze(property);
  }
}
