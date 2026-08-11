import type { FactChannel, FactOrder } from "#types/FactOrder.js";
import type { FactSections, TransportFact } from "#types/Facts.js";
import { AccountFacts } from "./accounts/AccountFacts.js";
import { ArchFacts } from "./arch/ArchFacts.js";
import { CommandFacts } from "./commands/CommandFacts.js";
import { CpuFacts } from "./cpu/CpuFacts.js";
import { MemoryFacts } from "./memory/MemoryFacts.js";
import { NetworkFacts } from "./network/NetworkFacts.js";
import { OsFacts } from "./os/OsFacts.js";
import { PackageFacts } from "./packages/PackageFacts.js";
import { PathFacts } from "./paths/PathFacts.js";
import { Platform } from "./platform/Platform.js";
import { PrivilegeFacts } from "./privileges/PrivilegeFacts.js";
import { ProcessFacts } from "./processes/ProcessFacts.js";
import { ServiceFacts } from "./services/ServiceFacts.js";
import { StorageFacts } from "./storage/StorageFacts.js";
import { ToolFacts } from "./tools/ToolFacts.js";
import { VirtualizationFacts } from "./virtualization/VirtualizationFacts.js";

/** One reading of a machine, section by section. */
export class Collecting {
  private readonly platform = Platform.current();
  private readonly operatingSystem = new OsFacts(this.platform);
  private readonly architecture = new ArchFacts(this.platform);
  private readonly processor = new CpuFacts();
  private readonly memory = new MemoryFacts();
  private readonly storage = new StorageFacts();
  private readonly network = new NetworkFacts();
  private readonly virtualization = new VirtualizationFacts(this.platform);
  private readonly privileges = new PrivilegeFacts();
  private readonly packages = new PackageFacts();
  private readonly accounts = new AccountFacts(this.platform);
  private readonly processes = new ProcessFacts(this.platform);
  private readonly services = new ServiceFacts(this.platform);
  private readonly tools = new ToolFacts(this.platform);
  private readonly paths = new PathFacts(this.platform);
  private readonly commands = new CommandFacts(this.platform);

  async read(request: FactOrder): Promise<FactSections> {
    const declared = request.declare ?? {};

    return {
      os: await this.operatingSystem.os(declared.os),
      arch: this.architecture.arch(declared.arch),
      cpu: await this.processor.cpu(declared.cpu),
      memory: await this.memory.memory(declared.memory),
      storage: await this.storage.storage(declared.storage),
      network: await this.network.network(declared.network),
      virtualization: this.virtualization.virtualization(declared.virtualization),
      privileges: this.privileges.privileges(declared.privileges),
      packages: await this.packages.packages(declared.packages),
      users: this.accounts.accounts(declared.users),
      groups: this.accounts.members(declared.groups),
      processes: await this.processes.processes(declared.processes),
      services: await this.services.services(declared.services),
      tools: await this.tools.tools(declared.tools),
      runtimes: await this.tools.runtimes(declared.runtimes),
      paths: this.paths.paths(declared.paths),
      artifacts: this.paths.artifacts(declared.artifacts),
      commands: await this.commands.commands(declared.commands),
      env: this.commands.env(declared.env),
      transports: this.transports(request.channel),
    };
  }

  /** The channel these facts were read through, when there was one. */
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
