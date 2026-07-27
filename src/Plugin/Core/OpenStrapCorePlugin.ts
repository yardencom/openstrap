import { createLocalFactsBackend } from "./LocalFactsBackend.js";
import { defineOpenStrapPlugin, type OpenStrapPlugin } from "../Domain/OpenStrapPlugin.js";

export const coreFactsBackendId = "openstrap:local";

export function openstrapCorePlugin(): OpenStrapPlugin {
  return defineOpenStrapPlugin({
    name: "openstrap:core",
    enforce: "pre",
    setup(api) {
      api.registerFactsBackend(createLocalFactsBackend(coreFactsBackendId));
    },
  });
}
