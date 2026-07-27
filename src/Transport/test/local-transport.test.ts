import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalTransport } from "../index.js";

describe("Local transport", () => {
  let directory: string;
  const transport = new LocalTransport();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "openstrap-transport-"));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  describe("file system", () => {
    it("reports a missing file as absent rather than failing", async () => {
      expect(await transport.fileSystem.readTextFile(join(directory, "absent"))).toBeNull();
      expect(await transport.fileSystem.mode(join(directory, "absent"))).toBeNull();
    });

    it("creates a directory exclusively only the first time", async () => {
      const path = join(directory, "lock");

      expect(await transport.fileSystem.createExclusiveDirectory(path)).toBe(true);
      expect(await transport.fileSystem.createExclusiveDirectory(path)).toBe(false);
    });

    it("writes a text file atomically and leaves no temporary behind", async () => {
      const path = join(directory, "nested", "state.json");

      await transport.fileSystem.writeTextFile(path, "first", { strategy: "atomic" });
      await transport.fileSystem.writeTextFile(path, "second", { strategy: "atomic" });

      expect(await readFile(path, "utf8")).toBe("second");
      expect(await transport.fileSystem.readTextFile(join(directory, "nested", "state.json"))).toBe("second");
    });

    it("replaces a symlink instead of writing through it", async () => {
      const secret = join(directory, "secret");
      const link = join(directory, "link");

      await writeFile(secret, "original", "utf8");
      await symlink(secret, link);
      await transport.fileSystem.writeTextFile(link, "replaced", { strategy: "atomic" });

      expect(await readFile(secret, "utf8")).toBe("original");
      expect((await stat(link)).isFile()).toBe(true);
    });

    it("applies the access mode named by the caller", async () => {
      const path = join(directory, "key");

      await transport.fileSystem.writeTextFile(path, "private", { access: "private" });

      expect(await transport.fileSystem.mode(path)).toBe(0o600);
    });

    it("refuses an access mode and a numeric mode together", async () => {
      await expect(
        transport.fileSystem.writeTextFile(join(directory, "conflict"), "x", { access: "private", mode: 0o644 }),
      ).rejects.toThrow(/cannot be specified together/);
    });

    it("refuses a path that escapes its directory", () => {
      expect(() => transport.fileSystem.resolvePathWithin(directory, "..", "escaped")).toThrow(/escapes its directory/);
      expect(transport.fileSystem.resolvePathWithin(directory, "inside", "file")).toBe(
        join(directory, "inside", "file"),
      );
    });
  });

  describe("processes", () => {
    it("captures output without failing on a non-zero exit", async () => {
      const result = await transport.processes.capture({
        command: "sh",
        args: ["-c", "printf out; printf err >&2; exit 3"],
        cwd: directory,
      });

      expect(result.exitCode).toBe(3);
      expect(result.stdout).toBe("out");
      expect(result.stderr).toBe("err");
    });

    it("reports a missing executable as a captured failure, not a rejection", async () => {
      const result = await transport.processes.capture({
        command: "openstrap-does-not-exist",
        args: [],
        cwd: directory,
      });

      expect(result.exitCode).toBeNull();
      expect(result.stderr).not.toBe("");
    });

    it("rejects when a run command exits non-zero", async () => {
      await expect(
        transport.processes.run({ command: "sh", args: ["-c", "exit 1"], cwd: directory, stdio: "ignore" }),
      ).rejects.toThrow(/Command failed/);
    });

    it("answers whether a command succeeds", async () => {
      const command = { args: ["-c", "exit 0"], command: "sh", cwd: directory, stdio: "ignore" as const };

      expect(await transport.processes.succeeds(command)).toBe(true);
      expect(await transport.processes.succeeds({ ...command, args: ["-c", "exit 1"] })).toBe(false);
    });

    it("knows this process is running and an unused pid is not", async () => {
      expect(await transport.processes.processRunning(process.pid)).toBe(true);
      expect(await transport.processes.processRunning(0x7ffffff)).toBe(false);
    });

    it("passes environment overrides and removes the ones set to undefined", async () => {
      const result = await transport.processes.capture({
        command: "sh",
        args: ["-c", "printf %s \"$OPENSTRAP_KEPT-${OPENSTRAP_DROPPED:-gone}\""],
        cwd: directory,
        environment: { OPENSTRAP_KEPT: "kept", OPENSTRAP_DROPPED: undefined },
      });

      expect(result.stdout).toBe("kept-gone");
    });
  });

  describe("network", () => {
    it("reports an unreachable endpoint as not ready instead of throwing", async () => {
      expect(await transport.network.endpointReady("http://127.0.0.1:1/", 250)).toBe(false);
    });

    it("returns the sha256 of what it downloaded", async () => {
      const payload = "ubuntu-image-bytes";
      const server = await serve((_request, response) => {
        response.writeHead(200);
        response.end(payload);
      });

      try {
        const destination = join(directory, "cache", "image.img");
        const result = await transport.network.download(server.url, destination);

        expect(result.bytes).toBe(payload.length);
        expect(result.sha256).toBe(createHash("sha256").update(payload).digest("hex"));
        expect(await readFile(destination, "utf8")).toBe(payload);
      } finally {
        await server.close();
      }
    });

    it("leaves no partial file behind when a download fails", async () => {
      const server = await serve((_request, response) => {
        response.writeHead(404);
        response.end();
      });

      try {
        const destination = join(directory, "cache", "missing.img");

        await expect(transport.network.download(server.url, destination)).rejects.toThrow(/Failed to download/);
        expect(await transport.fileSystem.readTextFile(destination)).toBeNull();
      } finally {
        await server.close();
      }
    });
  });
});

async function serve(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer(handler);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Test server did not bind a port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}
