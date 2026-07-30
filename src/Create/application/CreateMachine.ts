import { PinnedImageChangedError } from "../errors/PinnedImageChangedError.js";
import { ProviderUnavailableError } from "../errors/ProviderUnavailableError.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import type { MachineHandle, Provider, ProviderAvailability, ResolvedImage } from "../../Plugin/index.js";
import { KeychainSecretStore, SSHKeyPair } from "../../Secrets/index.js";
import type { MachineImageRecord, SqliteStateStore } from "../../StateStore/index.js";

export type CreateMachineRequest = {
  target: BlueprintTarget;
  provider: Provider;
  store: SqliteStateStore;
  /**
   * Replaces the image this target is pinned to with whatever its name resolves to now.
   *
   * Off by default: a pin that moves on its own is not a pin, so moving it is a person's decision.
   */
  repin?: boolean;
  hostPort: number;
  user?: string;
  now?: Date;
};

export type CreateStep = {
  name: string;
  status: "succeeded" | "skipped";
  detail?: string;
  /**
   * When the step finished.
   *
   * Taken as it happens, because the steps are written to the store only once the run is over and
   * nothing about a finished step says when it ran. Every step used to be recorded as having started
   * and finished at the instant the run began — one stamp copied over a whole run of work. They run
   * one after another, so a step started when the one before it finished and one stamp each says when.
   */
  finishedAt: string;
};

export type CreateMachineResult = {
  runId: string;
  handle: MachineHandle;
  endpoint: { host: string; port: number; user: string };
  image: { reference: string; url: string; sha256: string; format: string; boot: string };
  steps: CreateStep[];
  created: boolean;
};


const sizes: Record<string, { cpuCores: number; memoryBytes: number; diskBytes: number }> = {
  small: { cpuCores: 1, memoryBytes: 1024 * 1024 * 1024, diskBytes: 10 * 1024 * 1024 * 1024 },
  medium: { cpuCores: 2, memoryBytes: 2048 * 1024 * 1024, diskBytes: 20 * 1024 * 1024 * 1024 },
  large: { cpuCores: 4, memoryBytes: 4096 * 1024 * 1024, diskBytes: 40 * 1024 * 1024 * 1024 },
};

/**
 * Brings a declared target into being.
 *
 * Running it twice does not produce a second machine: an existing one is
 * adopted and reported, because a create that destroys what is already there
 * is not something anyone can run twice.
 */
export class CreateMachine {
  constructor(
    private readonly secrets = new KeychainSecretStore(),
    private readonly keys = new SSHKeyPair(),
  ) {}

  async execute(request: CreateMachineRequest): Promise<CreateMachineResult> {
    const target = request.target;
    const now = request.now ?? new Date();
    const timestamp = now.toISOString();
    const user = request.user ?? "openstrap";
    const steps: CreateStep[] = [];
    const done = (step: Omit<CreateStep, "finishedAt">) =>
      steps.push({ ...step, finishedAt: new Date().toISOString() });

    const availability = await request.provider.detect();

    if (!availability.available) {
      throw new ProviderUnavailableError(request.provider.id, availability);
    }

    done({ name: "detect provider", status: "succeeded", detail: availability.version });

    request.store.saveTarget({
      name: target.name,
      scope: target.scope,
      type: target.type,
      provider: target.provider,
      transport: target.transport,
    }, timestamp);
    request.store.saveDesiredState(target.name, target, timestamp);

    const runId = `run_${target.name}_${timestamp.replace(/[-:.]/g, "")}`;
    request.store.startRun({ id: runId, target: target.name, command: "create", startedAt: timestamp });

    try {
      const image = await this.image(request, timestamp);
      done({ name: "resolve image", status: "succeeded", detail: `${image.reference} ${image.sha256.slice(0, 12)}` });

      // Which file this run built with, as data. The step above says it as a sentence for a person.
      request.store.recordRunImage(runId, {
        reference: image.reference,
        url: image.url,
        sha256: image.sha256,
      });


      const existing = await request.provider.find(target.name);

      if (existing) {
        done({ name: "create machine", status: "skipped", detail: "a machine with this name already exists" });
        done(await this.ensureRunning(request.provider, existing));

        const access = await request.provider.access(existing);
        this.recordSteps(request.store, runId, steps, timestamp);
        request.store.finishRun(runId, "succeeded", new Date().toISOString());

        return { runId, handle: existing, endpoint: access.endpoint, image, steps, created: false };
      }

      const pair = this.keys.generate(`${user}@${target.name}`);
      const reference = this.secrets.reference(`${target.name}.ssh-identity`);
      await this.secrets.write(reference, pair.privateKey);
      request.store.saveSecretReference({
        target: target.name,
        purpose: "ssh-identity",
        store: reference.store,
        name: reference.name,
      }, timestamp);
      done({ name: "generate identity", status: "succeeded", detail: `${reference.store}:${reference.name}` });

      request.store.allocatePort({
        hostPort: request.hostPort,
        target: target.name,
        guestPort: 22,
        protocol: "tcp",
      }, timestamp);
      done({ name: "reserve host port", status: "succeeded", detail: String(request.hostPort) });

      const handle = await request.provider.create({
        name: target.name,
        image,
        resources: sizes[target.size ?? "medium"] ?? sizes.medium!,
        user,
        publicKey: pair.publicKey,
        hostPort: request.hostPort,
        guestPort: 22,
      });
      request.store.saveProviderResource({
        target: target.name,
        provider: request.provider.id,
        resourceId: handle.id,
      }, timestamp);
      done({ name: "create machine", status: "succeeded", detail: handle.id });

      await request.provider.start(handle);
      done({ name: "start machine", status: "succeeded" });

      const access = await request.provider.access(handle);
      this.recordSteps(request.store, runId, steps, timestamp);
      request.store.finishRun(runId, "succeeded", new Date().toISOString());

      return { runId, handle, endpoint: access.endpoint, image, steps, created: true };
    } catch (error) {
      this.recordSteps(request.store, runId, steps, timestamp);
      request.store.recordStep({
        runId,
        ordinal: steps.length + 1,
        name: "failed",
        status: "failed",
        startedAt: steps[steps.length - 1]?.finishedAt ?? timestamp,
        finishedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      });
      request.store.finishRun(runId, "failed", new Date().toISOString());

      throw error;
    }
  }

  /**
   * The image this target is made from — the same file every time, once there has been a first time.
   *
   * A pin is read before the provider is asked, and handed to it, so the provider fetches that file
   * rather than whatever the name means today. What comes back is checked against the pin anyway: a
   * provider is a plugin, and a rule that only holds while every plugin obeys it is not a rule.
   *
   * With no pin — the first create of this target, or `--repin` — what the name resolves to now
   * becomes the pin.
   */
  private async image(request: CreateMachineRequest, timestamp: string): Promise<ResolvedImage> {
    const reference = request.target.image ?? "ubuntu:24.04";
    const pinned = request.repin ? null : request.store.readMachineImage(request.target.name);
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
      request.store.saveMachineImage(request.target.name, madeFrom(reference, image), timestamp);
    }

    return image;
  }

  /**
   * Leaves an adopted machine in the state a created one would be left in.
   *
   * `create` promises a machine you can connect to, and it has to keep that
   * promise the second time it is run as well. A machine that was found stopped
   * and left stopped would satisfy "it already exists" and nothing else: every
   * step that follows — verifying it, connecting to it — is waiting on a machine
   * that is never going to answer.
   */
  private async ensureRunning(provider: Provider, machine: MachineHandle): Promise<Omit<CreateStep, "finishedAt">> {
    const state = await provider.inspect(machine);

    if (state.status === "running") {
      return { name: "start machine", status: "skipped", detail: "already running" };
    }

    await provider.start(machine);

    return { name: "start machine", status: "succeeded", detail: `was ${state.status}` };
  }

  /** @param runStartedAt When the run began, which is when its first step began. */
  private recordSteps(store: SqliteStateStore, runId: string, steps: readonly CreateStep[], runStartedAt: string): void {
    steps.forEach((step, index) => {
      store.recordStep({
        runId,
        ordinal: index + 1,
        name: step.name,
        status: step.status === "skipped" ? "skipped" : "succeeded",
        startedAt: steps[index - 1]?.finishedAt ?? runStartedAt,
        finishedAt: step.finishedAt,
        detail: step.detail,
      });
    });
  }
}

/** What is written down about an image: the file, and the name that was asked for. */
function madeFrom(reference: string, image: ResolvedImage): MachineImageRecord {
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
