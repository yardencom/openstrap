import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MachineHandle, Provider, ResolvedImage } from "../../../Plugin/index.js";
import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import { CreateMachine } from "../application/CreateMachine.js";
import { PinnedImageChangedError } from "../errors/PinnedImageChangedError.js";
import type { Images } from "../../../Modules/Images/index.js";
import { Store } from "../../../Store/index.js";

/**
 * Each create is given its own instant.
 *
 * A run is identified by target and timestamp, so two runs sharing one instant share an id — which
 * is a narrow defect of its own, and not the one this file is about.
 */
let clock = new Date("2026-07-29T10:00:00.000Z").getTime();

function nextInstant(): Date {
  clock += 1000;

  return new Date(clock);
}

/**
 * A pin is what makes a second create produce the first machine again.
 *
 * `ubuntu:24.04` is a name, and the URL it names serves whatever is current, so without a pin a
 * machine recreated a month later is a different machine answering to the same name. The lock file
 * openstrap used to write recorded that after the fact and was never read back, which is a log.
 */
describe("The image a target is pinned to", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("is written down the first time the target is created", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);

    expect(store.machines.pinOf("ubuntu-vm")).toEqual({
      reference: "ubuntu:24.04",
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
      platform: "linux",
      architecture: "arm64",
      format: "qcow2",
      boot: "uefi",
    });
  });

  it("is what the provider is asked for next time, rather than the name", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);
    await create(store, provider);

    // The provider is handed the pinned file both times: it is not asked what a name means.
    expect(provider.built.map((image) => image.sha256)).toEqual(["a".repeat(64), "a".repeat(64)]);
  });

  it("fails the run when what comes back is a different file", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);

    // Whatever the reason — the image moved upstream, or the provider ignored the pin — a create
    // that silently used something else would be the pin doing nothing at all.
    provider.sha256 = "b".repeat(64);

    await expect(create(store, provider)).rejects.toThrow(PinnedImageChangedError);
    await expect(create(store, provider)).rejects.toThrow(/pinned to ubuntu:24\.04 aaaaaaaaaaaa/);
    expect(store.machines.pinOf("ubuntu-vm")!.sha256).toBe("a".repeat(64));
  });

  it("fails the run when the blueprint asks for another image, which is a decision, not a drift", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);

    await expect(create(store, provider, { image: "ubuntu:26.04" })).rejects.toThrow(PinnedImageChangedError);
  });

  it("moves only when a person asks it to", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);

    provider.sha256 = "b".repeat(64);
    await create(store, provider, {}, { repin: true });

    expect(store.machines.pinOf("ubuntu-vm")!.sha256).toBe("b".repeat(64));
    // And the provider was handed the new file, not the one it is replacing.
    expect(provider.built.at(-1)!.sha256).toBe("b".repeat(64));
  });

  it("is one row, which is also what says which build to deliver to that machine", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);
    const image = store.machines.pinOf("ubuntu-vm")!;

    // Two questions with one answer: what to build from again, and what openstrap has to be built
    // for to run there. Two rows saying it would be two rows that can disagree.
    expect(image).toMatchObject({ sha256: "a".repeat(64), platform: "linux", architecture: "arm64" });
  });

  it("leaves the run history saying which file that run built with, as data", async () => {
    const provider = fakeProvider("a".repeat(64));

    const created = await create(store, provider);
    store.runs.finish(created.runId, "succeeded", "2026-07-29T10:00:01.000Z");

    const [run] = store.carried.waiting();

    // The step says it as a sentence with the checksum cut to twelve characters, which no one can
    // compare with anything. The history is asked instead — through what carries it to a server,
    // because that is the only thing that reads a run back.
    expect(store.runs.imageOf(run!.id)).toEqual({
      reference: "ubuntu:24.04",
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
    });
  });

  it("keeps what a repinned run built with, because the history is not the pin", async () => {
    const provider = fakeProvider("a".repeat(64));
    const first = await create(store, provider);
    provider.sha256 = "b".repeat(64);
    const second = await create(store, provider, {}, { repin: true });

    for (const runId of [first.runId, second.runId]) {
      store.runs.finish(runId, "succeeded", "2026-07-29T10:00:02.000Z");
    }

    const built = store.carried.waiting().map((run) => run.builtWith!.sha256).sort();

    expect(built).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(store.machines.pinOf("ubuntu-vm")!.sha256).toBe("b".repeat(64));
  });

  it("records the failure as a run that failed, not as no run at all", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);
    provider.sha256 = "b".repeat(64);

    await expect(create(store, provider)).rejects.toThrow(PinnedImageChangedError);

    const [run] = store.carried.waiting();

    expect(run!.status).toBe("failed");
    expect(run!.steps.at(-1)).toMatchObject({ name: "failed", status: "failed" });
  });
});

function create(
  store: Store,
  provider: FakeProvider,
  target: Partial<BlueprintTarget> = {},
  request: { repin?: boolean } = {},
) {
  return new CreateMachine().execute({
    target: {
      name: "ubuntu-vm",
      provider: "utm",
      image: "ubuntu:24.04",
      requirements: [],
      ...target,
    } as BlueprintTarget,
    machine: { name: "ubuntu-vm", scope: "guest", type: "vm" },
    provider,
    store,
    images: published(provider.sha256),
    publicKey: "ssh-ed25519 AAAA test",
    hostPort: 2222,
    repin: request.repin,
    now: nextInstant(),
  });
}

/** A publisher answering with `sha256`, which moves when the published file does — the whole test. */
function published(sha256: string): Images {
  return {
    resolve: async (reference: string) => ({
      reference,
      url: "https://images.example/noble-arm64.img",
      sha256,
      platform: "linux",
      architecture: "arm64",
      format: "qcow2",
      boot: "uefi",
    }),
  } as unknown as Images;
}

type FakeProvider = Provider & { built: ResolvedImage[]; sha256: string };

/**
 * A provider that remembers which file it was handed to build from.
 *
 * The file is decided before it is called, so what it records is what openstrap decided — which is
 * how the test plays both an image that moved upstream and a pin that was not honoured.
 */
function fakeProvider(sha256: string): FakeProvider {
  const built: ResolvedImage[] = [];
  const provider: FakeProvider = {
    id: "fake",
    built,
    sha256,
    capabilities: { scopes: ["guest"], types: ["vm"], resize: false, portForward: true },
    detect: async () => ({ available: true, version: "1.0" }),
    create: async (request): Promise<MachineHandle> => {
      built.push(request.image);

      return { id: "vm-1", name: "ubuntu-vm" };
    },
    start: async () => {},
    stop: async () => {},
    restart: async () => {},
    delete: async () => {},
    inspect: async () => ({ status: "running" as const }),
    access: async () => ({ transport: "ssh", endpoint: { host: "127.0.0.1", port: 2222, user: "openstrap" } }),
    find: async () => null,
  };

  return provider;
}

