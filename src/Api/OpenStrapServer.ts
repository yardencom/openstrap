import type { SecretReference, SecretStore } from "@openstrap/plugin-contract";
import { ServerRefusedError } from "./errors/ServerRefusedError.js";
import { ServerUnreachableError } from "./errors/ServerUnreachableError.js";
import type {
  FinishRunRequest,
  OpenRunRequest,
  OpenRunResponse,
  RecordResourceRequest,
  TargetAccessResponse,
  TargetSummary,
} from "./types/Api.js";

export type OpenStrapServerRequest = {
  url: string;
  token: string;
  /** Which organization to act in, where a caller belongs to more than one. */
  organization?: string;
  fetch?: typeof globalThis.fetch;
};

/**
 * openstrap-server, as everything openstrap can ask it.
 *
 * Four methods, and they are the server's own four. Nothing is decided here: the pin, the port, the
 * key and whether this organization may at all are answered there, in one transaction, because taken
 * apart each would be true at a different instant.
 */
export class OpenStrapServer {
  private readonly url: string;
  private readonly send: typeof globalThis.fetch;

  constructor(private readonly request: OpenStrapServerRequest) {
    this.url = request.url.replace(/\/+$/, "");
    this.send = request.fetch ?? globalThis.fetch;
  }

  /**
   * The server openstrap talks to.
   *
   * Written here and nowhere else. It was an environment variable, which meant every machine that
   * ran openstrap had to be told the same thing again, and a run that forgot worked anyway —
   * quietly, alone, against a record nobody else could see. Where the record lives is not something
   * each invocation gets to answer differently.
   */
  static readonly address = "http://127.0.0.1:8080";

  /** Where the token is kept, as the secret store this run has knows it. */
  static readonly token: SecretReference = { store: "keychain", name: "openstrap.server-token" };

  /**
   * The server this run talks to, or nothing at all.
   *
   * Nothing is an answer: with no secret store there is no token, and openstrap works on this
   * machine alone — which is what a laptop with a hypervisor on it is for. The token is never read
   * from a file and never written to one: a file of secrets beside openstrap is the thing openstrap
   * is not.
   */
  static async of(store: SecretStore | undefined): Promise<OpenStrapServer | undefined> {
    if (!store) {
      return undefined;
    }

    const token = (await store.read({ ...OpenStrapServer.token, store: store.id }))?.trim();

    return token ? new OpenStrapServer({ url: OpenStrapServer.address, token }) : undefined;
  }

  /** Everything openstrap needs before it touches a hypervisor. */
  openRun(request: OpenRunRequest): Promise<OpenRunResponse> {
    return this.json<OpenRunResponse>("POST", "/v1/runs", request);
  }

  /** The machine exists and this is its id at the provider — the one write that cannot be lost. */
  recordResource(runId: string, resource: RecordResourceRequest): Promise<void> {
    return this.nothing("POST", `/v1/runs/${encodeURIComponent(runId)}/resource`, resource);
  }

  /** What happened: steps, the reading that was taken, how it measured up. */
  finishRun(runId: string, report: FinishRunRequest): Promise<void> {
    return this.nothing("POST", `/v1/runs/${encodeURIComponent(runId)}/finish`, report);
  }

  /** Every machine this organization has. Whether any is running is asked where the hypervisor is. */
  async targets(): Promise<readonly TargetSummary[]> {
    return (await this.json<{ targets: TargetSummary[] }>("GET", "/v1/targets")).targets;
  }

  /** How to reach a machine that already exists. */
  targetAccess(target: string): Promise<TargetAccessResponse> {
    return this.json<TargetAccessResponse>("GET", `/v1/targets/${encodeURIComponent(target)}/access`);
  }

  private async json<TResult>(method: string, path: string, body?: unknown): Promise<TResult> {
    return await (await this.answered(method, path, body)).json() as TResult;
  }

  /** Recording a resource and finishing a run answer 204: there is nothing to read. */
  private async nothing(method: string, path: string, body?: unknown): Promise<void> {
    await this.answered(method, path, body);
  }

  private async answered(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await this.reach(method, path, body);

    if (!response.ok) {
      throw new ServerRefusedError(response.status, await OpenStrapServer.reason(response));
    }

    return response;
  }

  private reach(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.request.token}` };

    if (this.request.organization !== undefined) {
      headers["x-openstrap-org"] = this.request.organization;
    }

    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    return this.send(`${this.url}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch((cause: unknown) => {
      throw new ServerUnreachableError(this.url, cause);
    });
  }

  /** The server's own sentence, where it sent one: it knows why, and openstrap does not. */
  private static async reason(response: Response): Promise<string> {
    try {
      const body = await response.json() as { message?: string; error?: string };

      return body.message ?? body.error ?? `${response.status} ${response.statusText}`;
    } catch {
      return `${response.status} ${response.statusText}`;
    }
  }
}
