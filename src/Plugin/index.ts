export {
  OpenStrapPluginContainer,
  type OpenStrapPluginContainerCreateRequest,
} from "./application/OpenStrapPluginContainer.js";
export {
  ProviderRegistry,
  type RegisteredProvider,
} from "./application/ProviderRegistry.js";
export {
  TransportRegistry,
  type RegisteredTransport,
} from "./application/TransportRegistry.js";
export {
  SecretStoreRegistry,
  type RegisteredSecretStore,
} from "./application/SecretStoreRegistry.js";
export { OpenStrapConfig } from "./application/OpenStrapConfig.js";
export { PluginModule } from "./application/PluginModule.js";
export {
  OpenStrapRuntime,
  type OpenStrapRuntimeRequest,
} from "./application/OpenStrapRuntime.js";
export { OpenStrapPluginError } from "./errors/OpenStrapPluginError.js";
// What a plugin implements is published as `@openstrap/plugin-contract` and re-exported here for
// openstrap's own code (ADR 0008). Nothing to call: a plugin is an object, and openstrap checks it.
export type {
  ImageRequest,
  MachineAccess,
  MachineHandle,
  MachineRequest,
  MachineResources,
  MachineState,
  MachineStatus,
  OpenStrapPlugin,
  OpenStrapPluginApi,
  OpenStrapPluginConfig,
  OpenStrapPluginOption,
  OpenStrapPluginOrder,
  Provider,
  ProviderAvailability,
  ProviderCapabilities,
  ResolvedImage,
  SecretReference,
  SecretStore,
  TargetScope,
  TargetType,
  TransportConnection,
  TransportConnectionRequest,
  TransportConnector,
  TransportEndpoint,
} from "@openstrap/plugin-contract";
