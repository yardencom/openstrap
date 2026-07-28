import type { BlueprintTarget } from "../../Blueprint/index.js";
import type { MachineHandle, Provider, ProviderAvailability } from "../../Plugin/index.js";
import { KeychainSecretStore, SSHKeyPair } from "../../Secrets/index.js";
import { LockFile } from "../../LockFile/index.js";
import type { SqliteStateStore } from "../../StateStore/index.js";

export type CreateMachineRequest = {
  target: BlueprintTarget;
  provider: Provider;
  store: SqliteStateStore;
  lockFile?: LockFile;
  pluginVersions?: Record<string, string>;
  hostPort: number;
  user?: string;
  now?: Date;
};

export type CreateStep = {
  name: string;
  status: "succeeded" | "skipped";
  detail?: string;
};

export type CreateMachineResult = {
  runId: string;
  handle: MachineHandle;
  endpoint: { host: string; port: number; user: string };
  image: { reference: string; url: string; sha256: string; format: string; boot: string };
  steps: CreateStep[];
  created: boolean;
};

export class ProviderUnavailableError extends Error {
  constructor(providerId: string, availability: ProviderAvailability) {
    const install = availability.install ? `\n\n${availability.install.description}\n  ${availability.install.command}` : "";

    super(`Provider "${providerId}" is not available: ${availability.reason ?? "unknown reason"}${install}`);
    this.name = "ProviderUnavailableError";
  }
}

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

    const availability = await request.provider.detect();

    if (!availability.available) {
      throw new ProviderUnavailableError(request.provider.id, availability);
    }

    steps.push({ name: "detect provider", status: "succeeded", detail: availability.version });

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
      const image = await request.provider.resolveImage({
        name: target.image ?? "ubuntu:24.04",
        architecture: process.arch,
      });
      steps.push({ name: "resolve image", status: "succeeded", detail: `${image.reference} ${image.sha256.slice(0, 12)}` });

      request.lockFile?.record(target.name, {
        image: {
          resolved: image.url,
          sha256: image.sha256,
          signature: "verified",
          arch: image.architecture,
          format: image.format,
          boot: image.boot,
        },
        plugins: request.pluginVersions ?? {},
      });
      steps.push({ name: "write lock file", status: "succeeded" });

      const existing = await request.provider.find(target.name);

      if (existing) {
        steps.push({ name: "create machine", status: "skipped", detail: "a machine with this name already exists" });
        steps.push(await this.ensureRunning(request.provider, existing));

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
      steps.push({ name: "generate identity", status: "succeeded", detail: `${reference.store}:${reference.name}` });

      request.store.allocatePort({
        hostPort: request.hostPort,
        target: target.name,
        guestPort: 22,
        protocol: "tcp",
      }, timestamp);
      steps.push({ name: "reserve host port", status: "succeeded", detail: String(request.hostPort) });

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
      steps.push({ name: "create machine", status: "succeeded", detail: handle.id });

      await request.provider.start(handle);
      steps.push({ name: "start machine", status: "succeeded" });

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
        startedAt: timestamp,
        finishedAt: new Date().toISOString(),
        detail: error instanceof Error ? error.message : String(error),
      });
      request.store.finishRun(runId, "failed", new Date().toISOString());

      throw error;
    }
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
  private async ensureRunning(provider: Provider, machine: MachineHandle): Promise<CreateStep> {
    const state = await provider.inspect(machine);

    if (state.status === "running") {
      return { name: "start machine", status: "skipped", detail: "already running" };
    }

    await provider.start(machine);

    return { name: "start machine", status: "succeeded", detail: `was ${state.status}` };
  }

  private recordSteps(store: SqliteStateStore, runId: string, steps: readonly CreateStep[], startedAt: string): void {
    steps.forEach((step, index) => {
      store.recordStep({
        runId,
        ordinal: index + 1,
        name: step.name,
        status: step.status === "skipped" ? "skipped" : "succeeded",
        startedAt,
        finishedAt: startedAt,
        detail: step.detail,
      });
    });
  }
}
