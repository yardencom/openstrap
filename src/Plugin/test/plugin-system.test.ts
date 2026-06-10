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

function createNoopBackend(id: string): FactsBackend {
  return {
    id,
    capabilities: {
      scopes: ["host"],
      transports: ["local"],
      sections: ["os"],
    },
    collect: () => [],
  };
}
