import { createSystemInformationFactsBackend } from "./SystemInformationFactsBackend.js";
import { defineOpenStrapPlugin, type OpenStrapPlugin } from "../Domain/OpenStrapPlugin.js";

export const coreFactsBackendId = "openstrap:systeminformation";

export function openstrapCorePlugin(): OpenStrapPlugin {
  return defineOpenStrapPlugin({
    name: "openstrap:core",
    enforce: "pre",
    setup(api) {
      api.registerFactsBackend(createSystemInformationFactsBackend(coreFactsBackendId));
    },
  });
}
