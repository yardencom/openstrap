import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createOpenStrapRuntime,
  defineOpenStrapPlugin,
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  OpenStrapPluginContainer,
  OpenStrapPluginError,
  type FactsBackend,
  type Provider,
  type SecretStore,
  type TransportConnector,
} from "../index.js";

describe("OpenStrap plugin system", () => {
  it("applies plugins in pre, normal, post order", async () => {
    const order: string[] = [];

    await OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({
          name: "normal",
          setup: () => {
            order.push("normal");
          },
        }),
        defineOpenStrapPlugin({
          name: "post",
          enforce: "post",
          setup: () => {
            order.push("post");
          },
        }),
        defineOpenStrapPlugin({
          name: "pre",
          enforce: "pre",
          setup: () => {
            order.push("pre");
          },
        }),
      ],
    });

    expect(order).toEqual(["pre", "normal", "post"]);
  });

  it("registers facts backends through plugin setup", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({
          name: "test:facts",
          setup(api) {
            api.registerFactsBackend(createNoopBackend("test:facts-backend"));
          },
        }),
      ],
    });

    expect(container.factsBackends.require("test:facts-backend").id).toBe("test:facts-backend");
    expect(container.factsBackends.list()[0]).toMatchObject({
      pluginName: "test:facts",
    });
  });

  it("rejects duplicate facts backend ids", async () => {
    await expect(OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({
          name: "first",
          setup: (api) => api.registerFactsBackend(createNoopBackend("test:duplicate")),
        }),
        defineOpenStrapPlugin({
          name: "second",
          setup: (api) => api.registerFactsBackend(createNoopBackend("test:duplicate")),
        }),
      ],
    })).rejects.toThrow(OpenStrapPluginError);
  });

  it("registers a provider, a transport and a secret store from one plugin", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({
          name: "test:utm",
          setup(api) {
            api.registerProvider(createNoopProvider("utm"));
            api.registerTransport(createNoopTransport("ssh"));
            api.registerSecretStore(createNoopSecretStore("keychain"));
          },
        }),
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
        defineOpenStrapPlugin({ name: "first", setup: (api) => api.registerProvider(createNoopProvider("utm")) }),
        defineOpenStrapPlugin({ name: "second", setup: (api) => api.registerProvider(createNoopProvider("utm")) }),
      ],
    })).rejects.toThrow(OpenStrapPluginError);

    await expect(OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({ name: "first", setup: (api) => api.registerTransport(createNoopTransport("ssh")) }),
        defineOpenStrapPlugin({ name: "second", setup: (api) => api.registerTransport(createNoopTransport("ssh")) }),
      ],
    })).rejects.toThrow(OpenStrapPluginError);
  });

  it("rejects a provider that cannot drive a full machine lifecycle", async () => {
    const incomplete = createNoopProvider("utm");
    delete (incomplete as Partial<Provider>).restart;

    await expect(OpenStrapPluginContainer.create({
      plugins: [defineOpenStrapPlugin({ name: "broken", setup: (api) => api.registerProvider(incomplete) })],
    })).rejects.toThrow(/must expose restart\(\)/);
  });

  it("names the registered ids when a required one is missing", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [defineOpenStrapPlugin({ name: "test:utm", setup: (api) => api.registerProvider(createNoopProvider("utm")) })],
    });

    expect(() => container.providers.require("virtualbox")).toThrow(/Available providers: utm/);
  });

  it("accepts a facts backend that declares no transport", async () => {
    const container = await OpenStrapPluginContainer.create({
      plugins: [
        defineOpenStrapPlugin({
          name: "test:facts",
          setup: (api) => api.registerFactsBackend(createNoopBackend("test:transportless")),
        }),
      ],
    });

    expect(container.factsBackends.require("test:transportless").id).toBe("test:transportless");
  });

  it("creates runtime with core backend by default", async () => {
    const runtime = await createOpenStrapRuntime();

    expect(runtime.factsBackendId).toBe("openstrap:systeminformation");
    expect(runtime.factsBackend.id).toBe("openstrap:systeminformation");
    expect(runtime.pluginNames).toContain("openstrap:core");
  });

  it("loads plugin config and external plugin modules", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openstrap-plugin-"));
    const pluginPath = join(directory, "plugin.mjs");
    const configPath = join(directory, "openstrap.config.mjs");

    writeFileSync(pluginPath, `
      export default {
        name: "external-plugin",
        setup(api) {
          api.registerFactsBackend({
            id: "external:facts",
            capabilities: {
              scopes: ["host"],
              transports: ["local"],
              sections: ["os"]
            },
            collect() {
              return [];
            }
          });
        }
      };
    `);
    writeFileSync(configPath, `
      import plugin from "./plugin.mjs";

      export default {
        plugins: [plugin],
        facts: {
          backend: "external:facts"
        }
      };
    `);

    const plugin = await loadOpenStrapPlugin({
      cwd: directory,
      specifier: "./plugin.mjs",
    });
    const config = await loadOpenStrapPluginConfig({
      cwd: directory,
      configPath,
    });
    const runtime = await createOpenStrapRuntime({ config });

    expect(plugin.name).toBe("external-plugin");
    expect(runtime.factsBackendId).toBe("external:facts");
    expect(runtime.factsBackend.id).toBe("external:facts");
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

function createNoopBackend(id: string): FactsBackend {
  return {
    id,
    capabilities: {
      scopes: ["host"],
      sections: ["os"],
    },
    collect: async () => [],
  };
}
