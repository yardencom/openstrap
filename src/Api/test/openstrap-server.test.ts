import { describe, expect, it } from "vitest";

import { MissingServerTokenError } from "../errors/MissingServerTokenError.js";
import { OpenStrapServer } from "../OpenStrapServer.js";
import { ServerRefusedError } from "../errors/ServerRefusedError.js";
import { ServerUnreachableError } from "../errors/ServerUnreachableError.js";
import type { OpenRunRequest, OpenRunResponse } from "../types/Api.js";

type Asked = { url: string; method: string; headers: Record<string, string>; body?: string };

/** A server that answers whatever it is told to, and remembers what it was asked. */
function serverAnswering(answers: Array<{ status: number; body?: unknown }>) {
  const asked: Asked[] = [];
  const remaining = [...answers];
  const send: typeof globalThis.fetch = async (input, init) => {
    asked.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    });

    const answer = remaining.shift() ?? { status: 200, body: {} };

    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
      status: answer.status,
      headers: answer.body === undefined ? {} : { "content-type": "application/json" },
    });
  };

  return { asked, send };
}

const openRun: OpenRunRequest = {
  command: "create",
  host: { id: "host-1", platform: "darwin", architecture: "arm64" },
  target: {
    name: "ubuntu-vm",
    scope: "guest",
    type: "vm",
    transport: "ssh",
    provider: "utm",
    requirements: [],
  },
};

const opened: OpenRunResponse = {
  runId: "run_ubuntu-vm_1",
  image: {
    reference: "ubuntu:24.04",
    url: "https://images.example/noble-arm64.img",
    sha256: "a".repeat(64),
    format: "qcow2",
    boot: "uefi",
    platform: "linux",
    architecture: "arm64",
  },
  resources: { cpuCores: 2, memoryBytes: 2_147_483_648, diskBytes: 21_474_836_480 },
  user: "openstrap",
  hostPort: 2222,
  identity: { publicKey: "ssh-ed25519 AAAA", privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" },
};

function server(answers: Array<{ status: number; body?: unknown }>, url = "https://openstrap.example") {
  const answering = serverAnswering(answers);

  return {
    asked: answering.asked,
    openstrap: new OpenStrapServer({ url, token: "t0ken", fetch: answering.send }),
  };
}

describe("Which server this run talks to", () => {
  it("is none at all when no url is named, which is a laptop with a hypervisor on it", () => {
    expect(OpenStrapServer.fromEnvironment({})).toBeUndefined();
  });

  it("is refused when a url is named and nothing authenticates against it", () => {
    expect(() => OpenStrapServer.fromEnvironment({ OPENSTRAP_SERVER_URL: "https://openstrap.example" }))
      .toThrow(MissingServerTokenError);
  });

  it("is the one the environment names", () => {
    const named = OpenStrapServer.fromEnvironment({
      OPENSTRAP_SERVER_URL: "https://openstrap.example",
      OPENSTRAP_TOKEN: "t0ken",
    });

    expect(named).toBeInstanceOf(OpenStrapServer);
  });
});

describe("Opening a run", () => {
  it("asks the server, and answers with what it decided", async () => {
    const { openstrap, asked } = server([{ status: 201, body: opened }]);

    await expect(openstrap.openRun(openRun)).resolves.toEqual(opened);

    expect(asked[0]).toMatchObject({ url: "https://openstrap.example/v1/runs", method: "POST" });
    expect(JSON.parse(asked[0]!.body!)).toEqual(openRun);
  });

  it("carries the token, because a run belongs to whoever opened it", async () => {
    const { openstrap, asked } = server([{ status: 201, body: opened }]);

    await openstrap.openRun(openRun);

    expect(asked[0]!.headers["authorization"]).toBe("Bearer t0ken");
  });

  it("names an organization only when the caller belongs to more than one", async () => {
    const plain = serverAnswering([{ status: 201, body: opened }]);
    await new OpenStrapServer({ url: "https://o.example", token: "t", fetch: plain.send }).openRun(openRun);

    const chosen = serverAnswering([{ status: 201, body: opened }]);
    await new OpenStrapServer({ url: "https://o.example", token: "t", organization: "acme", fetch: chosen.send })
      .openRun(openRun);

    expect(plain.asked[0]!.headers["x-openstrap-org"]).toBeUndefined();
    expect(chosen.asked[0]!.headers["x-openstrap-org"]).toBe("acme");
  });

  it("does not double the slash a url was written with", async () => {
    const { openstrap, asked } = server([{ status: 201, body: opened }], "https://openstrap.example/");

    await openstrap.openRun(openRun);

    expect(asked[0]!.url).toBe("https://openstrap.example/v1/runs");
  });
});

describe("Telling the server what happened", () => {
  it("records a resource against the run it belongs to", async () => {
    const { openstrap, asked } = server([{ status: 204 }]);

    await expect(openstrap.recordResource("run_1", { provider: "utm", resourceId: "A1B2" }))
      .resolves.toBeUndefined();

    expect(asked[0]!.url).toBe("https://openstrap.example/v1/runs/run_1/resource");
  });

  it("finishes a run without expecting anything back", async () => {
    const { openstrap, asked } = server([{ status: 204 }]);

    await expect(openstrap.finishRun("run_1", { status: "succeeded", steps: [] })).resolves.toBeUndefined();

    expect(asked[0]!.url).toBe("https://openstrap.example/v1/runs/run_1/finish");
  });

  it("escapes a name rather than pasting it into a path", async () => {
    const { openstrap, asked } = server([{ status: 200, body: { provider: "utm" } }]);

    await openstrap.targetAccess("a/b");

    expect(asked[0]!.url).toBe("https://openstrap.example/v1/targets/a%2Fb/access");
  });
});

describe("When the server says no", () => {
  it("keeps its sentence, because it is the one that knows why", async () => {
    const { openstrap } = server([{
      status: 403,
      body: { error: "ForbiddenError", message: 'This organization does not allow the provider "utm"' },
    }]);

    await expect(openstrap.openRun(openRun))
      .rejects.toThrow('This organization does not allow the provider "utm"');
  });

  it("carries the status, so a caller can tell a refusal from a breakage", async () => {
    const { openstrap } = server([{ status: 409, body: { message: "already running" } }]);

    await expect(openstrap.openRun(openRun)).rejects.toMatchObject({
      name: "ServerRefusedError",
      status: 409,
    });
  });

  it("says so plainly when the answer is not something it can read", async () => {
    const { openstrap } = server([{ status: 502 }]);

    await expect(openstrap.openRun(openRun)).rejects.toBeInstanceOf(ServerRefusedError);
  });
});

describe("When nothing answers", () => {
  it("is a different failure from a refusal, and says which server", async () => {
    const openstrap = new OpenStrapServer({
      url: "https://openstrap.example",
      token: "t0ken",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(openstrap.openRun(openRun)).rejects.toBeInstanceOf(ServerUnreachableError);
    await expect(openstrap.openRun(openRun)).rejects.toThrow("https://openstrap.example");
  });
});
