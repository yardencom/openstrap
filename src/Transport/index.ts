// The ports themselves are the plugin contract — a transport is implemented by a plugin, so the shape
// it implements cannot live inside openstrap (ADR 0008). They are re-exported here for openstrap's own
// code, which reaches for a transport by module and should not have to know where the contract is
// published. What is openstrap's own is below the line: an implementation, which no plugin may take.
export type {
  BinaryFileWriteOptions,
  CapturedSystemCommand,
  DetachedProcessCommand,
  DownloadResult,
  FileAccess,
  FileSystemAPI,
  FileSystemWriteOptions,
  NetworkAPI,
  NetworkRequest,
  NetworkResponse,
  ProcessAPI,
  ProcessOutput,
  RemovePathOptions,
  SystemCommand,
  TextFileWriteOptions,
  Transport,
} from "@openstrap/plugin-contract";
export { LocalTransport } from "./adapters/local/LocalTransport.js";
