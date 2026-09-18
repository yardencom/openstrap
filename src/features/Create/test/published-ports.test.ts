import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MachineHandle, MachineRequest, Provider, PublishedPorts } from "../../../Plugin/index.js";
import type { BlueprintTarget } from "../../../Modules/Blueprint/index.js";
import type { Images } from "../../../Modules/Images/index.js";
import { CreateMachine } from "../application/CreateMachine.js";
import { Store } from "../../../Store/index.js";

type FakeProvider = Provider & {
  created: MachineRequest[];
  publishedWith: number[][];
};

const services = {
  postgres: { image: "postgres:17-alpine", port: 5432 },
  server: { image: "ghcr.io/x/server:1", port: 8080, public: true },
  admin: { image: "ghcr.io/x/admin:1", port: 8080, public: true },
};

describe("Ports of public services", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("are asked of the provider when the machine is made, once each, in order", async () => {
    const provider = fakeProvider({ exists: false });

    await create(store, provider, { services });

    expect(provider.created).toHaveLength(1);
    expect(provider.created[0]!.publish).toEqual([8080]);
    expect(provider.publishedWith).toEqual([]);
  });

  it("are published on a machine that already exists, and the run says what that took", async () => {
    const provider = fakeProvider({ exists: true, outcome: { added: [8080], restarted: true } });

    const made = await create(store, provider, { services });

    expect(provider.publishedWith).toEqual([[8080]]);
    expect(made.steps.find((step) => step.name === "publish ports")).toMatchObject({
      status: "succeeded",
      detail: "8080; the machine was restarted for it",
    });
  });

  it("are left alone when the provider already publishes them", async () => {
    const provider = fakeProvider({ exists: true, outcome: { added: [], restarted: false } });

    const made = await create(store, provider, { services });

    expect(made.steps.find((step) => step.name === "publish ports")).toMatchObject({
      status: "skipped",
      detail: "8080 already published",
    });
  });

  it("are nothing to publish where no service is public", async () => {
    const provider = fakeProvider({ exists: true });

    const made = await create(store, provider, { services: { postgres: services.postgres } });

    expect(provider.publishedWith).toEqual([]);
    expect(made.steps.find((step) => step.name === "publish ports")).toMatchObject({ status: "skipped", detail: "no public service" });
  });

  it("are skipped, and said to be, where the provider can publish only at creation", async () => {
    const provider = fakeProvider({ exists: true });
    delete (provider as Partial<Provider>).publish;

    const made = await create(store, provider, { services });

    expect(made.steps.find((step) => step.name === "publish ports")).toMatchObject({
      status: "skipped",
      detail: "fake publishes ports at creation only",
    });
  });
});

function create(store: Store, provider: FakeProvider, target: Partial<BlueprintTarget>) {
  return new CreateMachine().execute({
    target: {
      name: "shop",
      provider: "fake",
      image: "ubuntu:24.04",
      requirements: [],
      ...target,
    } as BlueprintTarget,
    machine: { name: "shop", scope: "guest", type: "vm" },
    provider,
    store,
    images: published(),
    publicKey: "ssh-ed25519 AAAA test",
    hostPort: 2222,
    now: new Date("2026-09-18T10:00:00.000Z"),
  });
}

function fakeProvider(options: { exists: boolean; outcome?: PublishedPorts }): FakeProvider {
  const handle: MachineHandle = { id: "vm-1", name: "shop" };
  const created: MachineRequest[] = [];
  const publishedWith: number[][] = [];

  return {
    id: "fake",
    created,
    publishedWith,
    capabilities: { scopes: ["guest"], types: ["vm"], resize: false, portForward: true },
    detect: async () => ({ available: true, version: "1.0" }),
    create: async (request) => {
      created.push(request);
      return handle;
    },
    start: async () => {},
    stop: async () => {},
    restart: async () => {},
    delete: async () => {},
    inspect: async () => ({ status: "running" as const }),
    access: async () => ({ transport: "ssh", endpoint: { host: "127.0.0.1", port: 2222, user: "openstrap" } }),
    find: async () => (options.exists ? handle : null),
    publish: async (_machine, ports) => {
      publishedWith.push([...ports]);
      return options.outcome ?? { added: [...ports], restarted: false };
    },
  };
}

function published(): Images {
  return {
    resolve: async (reference: string) => ({
      reference,
      url: "https://images.example/noble-arm64.img",
      sha256: "a".repeat(64),
      platform: "linux",
      architecture: "arm64",
      format: "qcow2",
      boot: "uefi",
    }),
  } as unknown as Images;
}
