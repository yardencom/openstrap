import { hostname } from "node:os";


import { NowhereToRecordError } from "../errors/NowhereToRecordError.js";
import { PinnedImageChangedError } from "../errors/PinnedImageChangedError.js";
import { ProviderUnavailableError } from "../errors/ProviderUnavailableError.js";
import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type {
  MachineAccess,
  MachineHandle,
  MachineResources,
  Provider,
  ResolvedImage,
} from "../../../Plugin/index.js";
import type { CreateStep } from "./CreateStep.js";
import { ReportRun } from "./ReportRun.js";
import type { DeclaredTarget, Host, OpenStrapServer } from "../../../OpenStrapServer/index.js";
import type { MachineImageRecord, SqliteStateStore, TargetRecord } from "../../../StateStore/index.js";
import type { Target } from "#types/Target.js";

export type CreateMachineRequest = {
  target: BlueprintTarget;
  machine: Target;
  provider: Provider;
  /** This machine's own record, which is where a machine lives when a run has no server. */
  store?: SqliteStateStore;
  /** The record a team shares. Where there is one it decides, and the store is not written. */
  server?: OpenStrapServer;
  /** The public half to plant, from the connector that owns the key. Not needed with a server. */
  publicKey?: string;
  /** Replaces the image this target is pinned to with whatever its name resolves to now. */
  repin?: boolean;
  /** Which host port to ask for. A server may answer with a different one, and its answer wins. */
  hostPort: number;
  user?: string;
  now?: Date;
};

export type CreateMachineResult = {
  runId: string;
  /** When the run began. The report of it is sent once the machine has also been read. */
  startedAt: string;
  handle: MachineHandle;
  /** Where the machine listens and what reaches it, as the provider reports. */
  access: MachineAccess;
  image: ResolvedImage;
  steps: CreateStep[];
  created: boolean;
  /** The key a server issued, where one did. Absent means the connector has its own.  */
  identity: { privateKey?: string };
};

/**
 * Everything openstrap needs before it touches a hypervisor.
 *
 * Which bytes to build from, how big, as whom, on which port, and with which key. Answered in one
 * place because the answers are bound together, and by the server where a run has one: a pin belongs
 * to an organization and a port is free or taken on a host, neither of which a blueprint can say.
 */
type Opened = {
  runId: string;
  image: ResolvedImage;
  resources: MachineResources;
  user: string;
  hostPort: number;
  publicKey: string;
  /** The key a server issued, where one did. Absent means the connector has its own. */
  identity: { privateKey?: string };
};

const sizes: Record<string, MachineResources> = {
  small: { cpuCores: 1, memoryBytes: 1024 * 1024 * 1024, diskBytes: 10 * 1024 * 1024 * 1024 },
  medium: { cpuCores: 2, memoryBytes: 2048 * 1024 * 1024, diskBytes: 20 * 1024 * 1024 * 1024 },
  large: { cpuCores: 4, memoryBytes: 4096 * 1024 * 1024, diskBytes: 40 * 1024 * 1024 * 1024 },
};

/** Brings a declared target into being. */
export class CreateMachine {
  async execute(request: CreateMachineRequest): Promise<CreateMachineResult> {
    const target = request.target;
    const timestamp = (request.now ?? new Date()).toISOString();
    const steps: CreateStep[] = [];
    const done = (step: Omit<CreateStep, "finishedAt">) =>
      steps.push({ ...step, finishedAt: new Date().toISOString() });

    if (!request.server && !request.store) {
      throw new NowhereToRecordError(target.name);
    }

    const availability = await request.provider.detect();

    if (!availability.available) {
      throw new ProviderUnavailableError(request.provider.id, availability);
    }

    done({ name: "detect provider", status: "succeeded", detail: availability.version });

    const opened = await this.open(request, timestamp, steps, done);

    try {
      const existing = await request.provider.find(target.name);

      if (existing) {
        done({ name: "create machine", status: "skipped", detail: "a machine with this name already exists" });
        done(await CreateMachine.ensureRunning(request.provider, existing));

        const access = await this.reached(request, existing, timestamp);
        await this.recordResource(request, opened.runId, existing);

        return {
          runId: opened.runId,
          startedAt: timestamp,
          handle: existing,
          access,
          image: opened.image,
          steps,
          created: false,
          identity: opened.identity,
        };
      }

      const handle = await request.provider.create({
        name: target.name,
        image: opened.image,
        resources: opened.resources,
        user: opened.user,
        publicKey: opened.publicKey,
        hostPort: opened.hostPort,
        guestPort: 22,
      });

      // Written the moment the provider hands an id back, before anything else can fail: a machine
      // that exists and is recorded nowhere is one nothing can find again.
      await this.recordResource(request, opened.runId, handle);
      done({ name: "create machine", status: "succeeded", detail: handle.id });

      await request.provider.start(handle);
      done({ name: "start machine", status: "succeeded" });

      const access = await this.reached(request, handle, timestamp);

      return {
        runId: opened.runId,
        startedAt: timestamp,
        handle,
        access,
        image: opened.image,
        steps,
        created: true,
        identity: opened.identity,
      };
    } catch (error) {
      // Reported here and not by the caller, because the caller never gets a run to report: making
      // the machine is where this failed, and a run left open is a machine nobody else may touch.
      await ReportRun.of({
        target: target.name,
        runId: opened.runId,
        startedAt: timestamp,
        steps,
        status: "failed",
        store: request.store,
        server: request.server,
        error,
      });

      throw error;
    }
  }

  /** What the blueprint does not say, from whichever holds the record of this target. */
  private open(
    request: CreateMachineRequest,
    timestamp: string,
    steps: readonly CreateStep[],
    done: (step: Omit<CreateStep, "finishedAt">) => void,
  ): Promise<Opened> {
    return request.server
      ? this.openOnServer(request.server, request, done)
      : this.openHere(request, timestamp, steps, done);
  }

  /**
   * The organization's answer, and it overrides this machine's opinion of every part of it.
   *
   * The image is resolved here and proposed rather than decided, because resolving a name into a file
   * is what a provider plugin does and plugins run beside the hypervisor. The first caller's answer
   * becomes the pin; everyone after gets the pin back, whatever their own catalogue says today.
   */
  private async openOnServer(
    server: OpenStrapServer,
    request: CreateMachineRequest,
    done: (step: Omit<CreateStep, "finishedAt">) => void,
  ): Promise<Opened> {
    const reference = request.target.image ?? "ubuntu:24.04";
    const proposed = await request.provider.resolveImage({ name: reference, architecture: process.arch });
    const opened = await server.openRun({
      command: "create",
      host: CreateMachine.thisHost(),
      target: CreateMachine.declared(request),
      proposedImage: proposed,
      repin: request.repin,
    });

    done({
      name: "resolve image",
      status: "succeeded",
      detail: `${opened.image.reference} ${opened.image.sha256.slice(0, 12)}`,
    });

    return {
      runId: opened.runId,
      image: opened.image,
      resources: opened.resources,
      user: opened.user,
      hostPort: opened.hostPort,
      publicKey: opened.identity.publicKey,
      // The value, because the server issued the key and there is no store of openstrap's to look in.
      identity: { privateKey: opened.identity.privateKey },
    };
  }

  /** This machine's own answer, which is the whole of it when nobody else is keeping the record. */
  private async openHere(
    request: CreateMachineRequest,
    timestamp: string,
    steps: readonly CreateStep[],
    done: (step: Omit<CreateStep, "finishedAt">) => void,
  ): Promise<Opened> {
    const store = request.store!;
    const target = request.target;

    // Written before anything else is: a port reservation, a key and a run all belong to a target,
    // and the row they point at has to be there first. How the machine is reached is not part of it
    // yet — nothing has reached it — and is written below, once the provider has said.
    store.saveTarget({ ...CreateMachine.record(request), transport: target.transport }, timestamp);
    store.saveDesiredState(target.name, target, timestamp);

    const runId = `run_${target.name}_${timestamp.replace(/[-:.]/g, "")}`;
    store.startRun({ id: runId, target: target.name, command: "create", startedAt: timestamp });

    // From here the run exists, so a failure is a run that failed rather than one left open forever.
    // The image is the first thing that can fail — a pin that no longer matches is a refusal, not a
    // newer image — and it fails before the caller has been given anything to report against.
    return this.decidedHere(request, runId, timestamp, done).catch(async (error: unknown) => {
      await ReportRun.of({
        target: target.name,
        runId,
        startedAt: timestamp,
        steps,
        status: "failed",
        store,
        error,
      });

      throw error;
    });
  }

  private async decidedHere(
    request: CreateMachineRequest,
    runId: string,
    timestamp: string,
    done: (step: Omit<CreateStep, "finishedAt">) => void,
  ): Promise<Opened> {
    const store = request.store!;
    const target = request.target;
    const image = await this.image(request, timestamp);
    done({ name: "resolve image", status: "succeeded", detail: `${image.reference} ${image.sha256.slice(0, 12)}` });

    // Which file this run built with, as data. The step above says it as a sentence for a person.
    store.recordRunImage(runId, { reference: image.reference, url: image.url, sha256: image.sha256 });

    const user = request.user ?? "openstrap";

    // Made by the connector that will use it, and openstrap sees only the half that goes into the
    // machine. Which is why there is nothing here to write down about it.
    done({ name: "plant identity", status: "succeeded", detail: request.publicKey!.slice(0, 40) });

    done({ name: "forward host port", status: "succeeded", detail: String(request.hostPort) });

    return {
      runId,
      image,
      resources: sizes[target.size ?? "medium"] ?? sizes.medium!,
      user,
      hostPort: request.hostPort,
      publicKey: request.publicKey!,
      identity: {},
    };
  }

  /**
   * The machine exists and this is its id at the provider.
   *
   * Only where a server is keeping the record. On this machine nothing is written: the provider knows
   * its own machines by name, and a remembered id is a second answer that can go stale while the
   * provider's cannot.
   */
  private async recordResource(
    request: CreateMachineRequest,
    runId: string,
    handle: MachineHandle,
  ): Promise<void> {
    await request.server?.recordResource(runId, { provider: request.provider.id, resourceId: handle.id });
  }

  /** How the machine is reached, asked of the provider that made it. */
  private async reached(
    request: CreateMachineRequest,
    machine: MachineHandle,
    timestamp: string,
  ): Promise<MachineAccess> {
    const access = await request.provider.access(machine);

    // Only here: a server was told what this target is when the run was opened, and telling it twice
    // is how the two answers start to differ.
    request.store?.saveTarget({
      ...CreateMachine.record(request),
      transport: request.target.transport ?? access.transport,
    }, timestamp);

    return access;
  }

  /** The image this target is made from — the same file every time, once there has been a first time. */
  private async image(request: CreateMachineRequest, timestamp: string): Promise<ResolvedImage> {
    const store = request.store!;
    const reference = request.target.image ?? "ubuntu:24.04";
    const pinned = request.repin ? null : store.readMachineImage(request.target.name);
    const image = await request.provider.resolveImage({
      name: reference,
      architecture: process.arch,
      pinned: pinned ? { url: pinned.url, sha256: pinned.sha256 } : undefined,
    });

    if (pinned && (image.sha256 !== pinned.sha256 || reference !== pinned.reference)) {
      throw new PinnedImageChangedError(
        request.target.name,
        { reference: pinned.reference, sha256: pinned.sha256 },
        { reference, sha256: image.sha256 },
      );
    }

    if (!pinned) {
      store.saveMachineImage(request.target.name, CreateMachine.madeFrom(reference, image), timestamp);
    }

    return image;
  }

  /** Leaves an adopted machine in the state a created one would be left in. */
  private static async ensureRunning(
    provider: Provider,
    machine: MachineHandle,
  ): Promise<Omit<CreateStep, "finishedAt">> {
    const state = await provider.inspect(machine);

    if (state.status === "running") {
      return { name: "start machine", status: "skipped", detail: "already running" };
    }

    await provider.start(machine);

    return { name: "start machine", status: "succeeded", detail: `was ${state.status}` };
  }

  private static record(request: CreateMachineRequest): Omit<TargetRecord, "transport"> {
    return {
      name: request.machine.name,
      scope: request.machine.scope,
      type: request.machine.type,
      provider: request.target.provider,
    };
  }

  /** The machine openstrap is running on: a port is only occupied on the host that forwards it. */
  private static thisHost(): Host {
    return { id: hostname(), platform: process.platform, architecture: process.arch };
  }

  /** The blueprint's words for this target, as the other side spells them. */
  private static declared(request: CreateMachineRequest): DeclaredTarget {
    const target = request.target;

    return {
      name: target.name,
      scope: request.machine.scope,
      type: request.machine.type,
      transport: target.transport ?? "ssh",
      requirements: [...target.requirements],
      ...(target.displayName === undefined ? {} : { displayName: target.displayName }),
      ...(target.provider === undefined ? {} : { provider: target.provider }),
      ...(target.image === undefined ? {} : { image: target.image }),
      ...(target.size === undefined ? {} : { size: target.size }),
    };
  }

  private static madeFrom(reference: string, image: ResolvedImage): MachineImageRecord {
    return {
      reference,
      url: image.url,
      sha256: image.sha256,
      platform: image.platform,
      architecture: image.architecture,
      format: image.format,
      boot: image.boot,
    };
  }
}
