import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ImageRequest, MachineHandle, Provider, ResolvedImage } from "../../Plugin/index.js";
import type { BlueprintTarget } from "../../Modules/Blueprint/index.js";
import { CreateMachine } from "../application/CreateMachine.js";
import { PinnedImageChangedError } from "../errors/PinnedImageChangedError.js";
import { SqliteStateStore } from "../../StateStore/index.js";

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
  let store: SqliteStateStore;

  beforeEach(() => {
    store = new SqliteStateStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("is written down the first time the target is created", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);

    expect(store.readMachineImage("ubuntu-vm")).toEqual({
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

    expect(provider.asked[0]!.pinned).toBeUndefined();
    expect(provider.asked[1]!.pinned).toEqual({
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
    });
  });

  it("fails the run when what comes back is a different file", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);

    // Whatever the reason — the image moved upstream, or the provider ignored the pin — a create
    // that silently used something else would be the pin doing nothing at all.
    provider.sha256 = "b".repeat(64);

    await expect(create(store, provider)).rejects.toThrow(PinnedImageChangedError);
    await expect(create(store, provider)).rejects.toThrow(/pinned to ubuntu:24\.04 aaaaaaaaaaaa/);
    expect(store.readMachineImage("ubuntu-vm")!.sha256).toBe("a".repeat(64));
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

    expect(store.readMachineImage("ubuntu-vm")!.sha256).toBe("b".repeat(64));
    // Asked for the name, not for the pin it is about to replace.
    expect(provider.asked[1]!.pinned).toBeUndefined();
  });

  it("is one row, which is also what says which build to deliver to that machine", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);
    const image = store.readMachineImage("ubuntu-vm")!;

    // Two questions with one answer: what to build from again, and what openstrap has to be built
    // for to run there. Two rows saying it would be two rows that can disagree.
    expect(image).toMatchObject({ sha256: "a".repeat(64), platform: "linux", architecture: "arm64" });
  });

  it("leaves the run history saying which file that run built with, as data", async () => {
    const provider = fakeProvider("a".repeat(64));

    await create(store, provider);
    const [run] = store.listRuns("ubuntu-vm");

    // The step says it as a sentence with the checksum cut to twelve characters, which no one can
    // compare with anything. The history is asked instead.
    expect(store.readRunImage(run!.id)).toEqual({
      reference: "ubuntu:24.04",
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
    });
  });

  it("keeps what a repinned run built with, because the history is not the pin", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);
    provider.sha256 = "b".repeat(64);
    await create(store, provider, {}, { repin: true });

    const runs = store.listRuns("ubuntu-vm");
    const built = runs.map((run) => store.readRunImage(run.id)!.sha256).sort();

    expect(built).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(store.readMachineImage("ubuntu-vm")!.sha256).toBe("b".repeat(64));
  });

  it("records the failure as a run that failed, not as no run at all", async () => {
    const provider = fakeProvider("a".repeat(64));
    await create(store, provider);
    provider.sha256 = "b".repeat(64);

    await expect(create(store, provider)).rejects.toThrow(PinnedImageChangedError);

    const runs = store.listRuns("ubuntu-vm");

    expect(runs[0]!.status).toBe("failed");
    expect(store.listSteps(runs[0]!.id).at(-1)).toMatchObject({ name: "failed", status: "failed" });
  });
});

function create(
  store: SqliteStateStore,
  provider: FakeProvider,
  target: Partial<BlueprintTarget> = {},
  request: { repin?: boolean } = {},
) {
  return new CreateMachine(fakeSecrets(), fakeKeys()).execute({
    target: {
      name: "ubuntu-vm",
      scope: "guest",
      type: "vm",
      provider: "utm",
      transport: "ssh",
      image: "ubuntu:24.04",
      requirements: [],
      ...target,
    } as BlueprintTarget,
    provider,
    store,
    hostPort: 2222,
    repin: request.repin,
    now: nextInstant(),
  });
}

type FakeProvider = Provider & { asked: ImageRequest[]; sha256: string };

/**
 * A provider that resolves a name to a file and remembers what it was asked.
 *
 * It answers with `sha256` whatever it is handed, which is how the test plays both an image that
 * moved upstream and a plugin that ignores the pin: openstrap has to notice either way.
 */
function fakeProvider(sha256: string): FakeProvider {
  const asked: ImageRequest[] = [];
  const provider: FakeProvider = {
    id: "fake",
    asked,
    sha256,
    capabilities: { scopes: ["guest"], types: ["vm"], resize: false, portForward: true },
    detect: async () => ({ available: true, version: "1.0" }),
    resolveImage: async (request: ImageRequest): Promise<ResolvedImage> => {
      asked.push(request);

      return {
        reference: request.name,
        url: "https://images.example/noble-arm64.img",
        sha256: provider.sha256,
        platform: "linux",
        architecture: "arm64",
        format: "qcow2",
        boot: "uefi",
      };
    },
    create: async (): Promise<MachineHandle> => ({ id: "vm-1", name: "ubuntu-vm" }),
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

/** No keychain is touched by a test: it would write into the machine the test runs on. */
function fakeSecrets() {
  return {
    reference: (name: string) => ({ store: "test", name }),
    read: async () => null,
    write: async () => {},
    remove: async () => {},
  } as unknown as ConstructorParameters<typeof CreateMachine>[0];
}

function fakeKeys() {
  return {
    generate: () => ({ privateKey: "private", publicKey: "ssh-ed25519 AAAA test" }),
  } as unknown as ConstructorParameters<typeof CreateMachine>[1];
}
