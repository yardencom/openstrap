import { SystemInformationFactCollector } from "../../Facts/Adapters/SystemInformationFactCollector.js";
import type { FactsBackend } from "../Domain/FactsBackend.js";
import { defineOpenStrapPlugin, type OpenStrapPlugin } from "../Domain/OpenStrapPlugin.js";

export const coreFactsBackendId = "openstrap:systeminformation";

export function openstrapCorePlugin(): OpenStrapPlugin {
  return defineOpenStrapPlugin({
    name: "openstrap:core",
    enforce: "pre",
    setup(api) {
      api.registerFactsBackend(createCoreFactsBackend());
    },
  });
}

function createCoreFactsBackend(): FactsBackend {
  const collector = new SystemInformationFactCollector();

  return {
    id: coreFactsBackendId,
    displayName: "OpenStrap core systeminformation backend",
    capabilities: {
      scopes: ["host", "guest", "network"],
      sections: [
        "os",
        "arch",
        "cpu",
        "memory",
        "storage",
        "network",
        "users",
        "packages",
        "processes",
        "services",
        "transports",
        "privileges",
        "runtimes",
        "paths",
        "tools",
      ],
    },
    collect: (request) => collector.collect(request),
  };
}
