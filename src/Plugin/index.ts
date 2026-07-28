export {
  OpenStrapPluginContainer,
  type OpenStrapPluginContainerCreateRequest,
} from "./Application/OpenStrapPluginContainer.js";
export {
  ProviderRegistry,
  type RegisteredProvider,
} from "./Application/ProviderRegistry.js";
export {
  TransportRegistry,
  type RegisteredTransport,
} from "./Application/TransportRegistry.js";
export {
  SecretStoreRegistry,
  type RegisteredSecretStore,
} from "./Application/SecretStoreRegistry.js";
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
} from "./Domain/Provider.js";
export type {
  TransportConnection,
  TransportConnectionRequest,
  TransportConnector,
  TransportEndpoint,
} from "./Domain/Transport.js";
export type {
  SecretReference,
  SecretStore,
} from "./Domain/Secret.js";
export {
  loadOpenStrapPlugin,
  loadOpenStrapPluginConfig,
  type LoadOpenStrapPluginConfigRequest,
  type LoadOpenStrapPluginRequest,
} from "./Application/OpenStrapPluginLoader.js";
export {
  createOpenStrapRuntime,
  loadOpenStrapRuntime,
  type LoadOpenStrapRuntimeRequest,
  type OpenStrapRuntime,
  type OpenStrapRuntimeCreateRequest,
} from "./Application/OpenStrapRuntime.js";
export {
  defineOpenStrapConfig,
  defineOpenStrapPlugin,
  type OpenStrapPlugin,
  type OpenStrapPluginApi,
  type OpenStrapPluginConfig,
  type OpenStrapPluginOption,
  type OpenStrapPluginOrder,
} from "./Domain/OpenStrapPlugin.js";
export { OpenStrapPluginError } from "./Domain/OpenStrapPluginError.js";
