import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  Provider,
  SecretStore,
  TransportConnector,
} from "@openstrap/plugin-contract";

import {
  OpenStrapConfig,
  OpenStrapPluginContainer,
  OpenStrapPluginError,
  OpenStrapRuntime,
  PluginModule,
} from "../index.js";

describe("OpenStrap plugin system", () => {
  it("applies plugins in pre, normal, post order", async () => {
    const order: string[] = [];

    await OpenStrapPluginContainer.create({
      plugins: [
        {
          name: "normal",
          setup: () => {
            order.push("normal");
          },
        },
        {
          name: "post",
          enforce: "post",
          setup: () => {
            order.push("post");
          },
        },
        {
          name: "pre",
          enforce: "pre",
          setup: () => {
            order.push("pre");
          },
        },
      ],
    });

    expect(order).toEqual(["pre", "normal", "post"]);
  });

  it("registers a provider, a transport and a secret store from one plugin", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [
        {
          name: "test:utm",
          setup(api) {
            api.registerProvider(createNoopProvider("utm"));
            api.registerTransport(createNoopTransport("ssh"));
            api.registerSecretStore(createNoopSecretStore("keychain"));
          },
        },
      ],
    });

    expect(container.providers.require("utm").id).toBe("utm");
    expect(container.transports.require("ssh").id).toBe("ssh");
    expect(container.secretStores.require("keychain").id).toBe("keychain");
    expect(container.providers.list()[0]).toMatchObject({ pluginName: "test:utm" });
  });

  it("rejects duplicate provider and transport ids", async () => {
    await expect(OpenStrapPluginContainer.create({
      plugins: [
        { name: "first", setup: (api) => api.registerProvider(createNoopProvider("utm")) },
        { name: "second", setup: (api) => api.registerProvider(createNoopProvider("utm")) },
      ],
    })).rejects.toThrow(OpenStrapPluginError);

    await expect(OpenStrapPluginContainer.create({
      plugins: [
        { name: "first", setup: (api) => api.registerTransport(createNoopTransport("ssh")) },
        { name: "second", setup: (api) => api.registerTransport(createNoopTransport("ssh")) },
      ],
    })).rejects.toThrow(OpenStrapPluginError);
  });

  it("rejects a provider that cannot drive a full machine lifecycle", async () => {
    const incomplete = createNoopProvider("utm");
    delete (incomplete as Partial<Provider>).restart;

    await expect(OpenStrapPluginContainer.create({
      plugins: [{ name: "broken", setup: (api) => api.registerProvider(incomplete) }],
    })).rejects.toThrow(/must expose restart\(\)/);
  });

  it("names the registered ids when a required one is missing", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [{ name: "test:utm", setup: (api) => api.registerProvider(createNoopProvider("utm")) }],
    });

    expect(() => container.providers.require("virtualbox")).toThrow(/Available providers: utm/);
  });

  it("offers no facts registry, because there is one way to read a machine", async () => {
    const runtime = new OpenStrapRuntime(await OpenStrapPluginContainer.create());
    let slots: string[] = [];

    const container = await OpenStrapPluginContainer.create({
      plugins: [{
        name: "capture",
        setup: (api) => {
          slots = Object.keys(api);
        },
      }],
    });

    expect(runtime).not.toHaveProperty("factsBackend");
    expect(runtime).not.toHaveProperty("factsBackendId");
    expect(runtime.pluginNames).toEqual([]);
    expect(container).not.toHaveProperty("factsBackends");
    expect(slots).toEqual(["registerCommand", "registerProvider", "registerTransport", "registerSecretStore"]);
  });

  it("loads plugin config and external plugin modules", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-plugin-"));
    const pluginPath = join(directory, "plugin.mjs");
    const configPath = join(directory, "openstrap.config.mjs");

    writeFileSync(pluginPath, `
      export default {
        name: "external-plugin",
        setup(api) {
          api.registerTransport({
            id: "external:ssh",
            connect() {
              throw new Error("not used in this test");
            }
          });
        }
      };
    `);
    writeFileSync(configPath, `
      import plugin from "./plugin.mjs";

      export default {
        plugins: [plugin]
      };
    `);

    const plugin = await new PluginModule(directory, "./plugin.mjs").plugin();
    const config = await new OpenStrapConfig(directory, configPath).read();
    const runtime = new OpenStrapRuntime(await OpenStrapPluginContainer.create({ plugins: config.plugins }));

    expect(plugin.name).toBe("external-plugin");
    expect(runtime.pluginNames).toEqual(["external-plugin"]);
    expect(runtime.transports.require("external:ssh").id).toBe("external:ssh");
  });
});

function createNoopProvider(id: string): Provider {
  return {
    id,
    capabilities: {
      scopes: ["guest"],
      types: ["vm"],
      resize: false,
      portForward: true,
    },
    detect: async () => ({ available: true }),
    resolveImage: async () => {
      throw new Error("not used in this test");
    },
    create: async () => ({ id: "machine-1", name: "test" }),
    start: async () => {},
    stop: async () => {},
    restart: async () => {},
    delete: async () => {},
    inspect: async () => ({ status: "stopped" as const }),
    access: async () => ({
      transport: "ssh",
      endpoint: { host: "127.0.0.1", port: 22, user: "openstrap" },
    }),
    find: async () => null,
  };
}

function createNoopTransport(id: string): TransportConnector {
  return {
    id,
    connect: async () => {
      throw new Error("not used in this test");
    },
  };
}

function createNoopSecretStore(id: string): SecretStore {
  return {
    id,
    read: async () => null,
    write: async () => {},
    remove: async () => {},
  };
}
