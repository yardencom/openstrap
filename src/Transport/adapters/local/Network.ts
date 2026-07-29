import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getCACertificates, setDefaultCACertificates } from "node:tls";

import type {
  DownloadResult,
  NetworkAPI,
  NetworkRequest,
  NetworkResponse,
} from "../../domain/Network.js";

export class LocalNetwork implements NetworkAPI {
  constructor() {
    const trusted = new Set([
      ...getCACertificates("default"),
      ...getCACertificates("system"),
    ]);
    setDefaultCACertificates([...trusted]);
  }

  async download(url: string, destination: string): Promise<DownloadResult> {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download resource: ${url}`);
    }

    await mkdir(dirname(destination), { recursive: true });
    const hash = createHash("sha256");
    let bytes = 0;
    const inspect = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        Readable.from(readChunks(response.body), { objectMode: false }),
        inspect,
        createWriteStream(destination),
      );
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }

    return {
      bytes,
      sha256: hash.digest("hex"),
    };
  }

  async endpointReady(url: string, timeoutMs: number): Promise<boolean> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async readText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to read resource: ${url}`);
    }

    return response.text();
  }

  async request(url: string, request: NetworkRequest): Promise<NetworkResponse> {
    const { timeoutMs = 30_000, ...requestInit } = request;
    const response = await fetch(url, {
      ...requestInit,
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      body: await response.text(),
      status: response.status,
    };
  }
}

/**
 * Reads a fetch body chunk by chunk.
 *
 * The web stream is drained through its own reader rather than adapted with
 * Readable.fromWeb, because the DOM ReadableStream that fetch is typed with and
 * the one node:stream expects are not the same declaration.
 */
async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
