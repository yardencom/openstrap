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
export type {
  ImageRequest,
  MachineAccess,
  MachineHandle,
  MachineRequest,
  MachineResources,
  MachineState,
  MachineStatus,
  Provider,
  ProviderAvailability,
  ProviderCapabilities,
  ResolvedImage,
  TargetScope,
  TargetType,
} from "./domain/Provider.js";
export type {
  TransportConnection,
  TransportConnectionRequest,
  TransportConnector,
  TransportEndpoint,
} from "./domain/Transport.js";
export type {
  SecretReference,
  SecretStore,
} from "./domain/Secret.js";
export {
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  type LoadOpenStrapPluginConfigRequest,
  type LoadOpenStrapPluginRequest,
} from "./application/OpenStrapPluginLoader.js";
export {
  createOpenStrapRuntime,
  loadOpenStrapRuntime,
  type LoadOpenStrapRuntimeRequest,
  type OpenStrapRuntime,
  type OpenStrapRuntimeCreateRequest,
} from "./application/OpenStrapRuntime.js";
export {
  defineOpenStrapConfig,
  defineOpenStrapPlugin,
  type OpenStrapPlugin,
  type OpenStrapPluginApi,
  type OpenStrapPluginConfig,
  type OpenStrapPluginOption,
  type OpenStrapPluginOrder,
} from "./domain/OpenStrapPlugin.js";
export { OpenStrapPluginError } from "./domain/OpenStrapPluginError.js";
