import { ServerRefusedError } from "./errors/ServerRefusedError.js";
import { ServerUnreachableError } from "./errors/ServerUnreachableError.js";
import { MissingServerTokenError } from "./errors/MissingServerTokenError.js";
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
   * The server this run talks to, or nothing at all.
   *
   * Nothing is an answer: without a server openstrap works on this machine alone, which is what a
   * laptop with a hypervisor on it is for. The token is not read from a file — a file of secrets
   * beside openstrap is the thing openstrap is not.
   */
  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): OpenStrapServer | undefined {
    const url = environment.OPENSTRAP_SERVER_URL?.trim();

    if (!url) {
      return undefined;
    }

    const token = environment.OPENSTRAP_TOKEN?.trim();

    if (!token) {
      throw new MissingServerTokenError(url);
    }

    return new OpenStrapServer({ url, token, organization: environment.OPENSTRAP_ORG?.trim() || undefined });
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
