export type DownloadResult = {
  bytes: number;
  sha256: string;
};

export type NetworkRequest = {
  body?: string;
  headers: Record<string, string>;
  method: "GET" | "POST";
  timeoutMs?: number;
};

export type NetworkResponse = {
  body: string;
  status: number;
};

export interface NetworkAPI {
  download(url: string, destination: string): Promise<DownloadResult>;
  endpointReady(url: string, timeoutMs: number): Promise<boolean>;
  readText(url: string): Promise<string>;
  request(url: string, request: NetworkRequest): Promise<NetworkResponse>;
}
