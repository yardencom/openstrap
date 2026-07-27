import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { KeychainSecretStore, SSHKeyPair } from "../index.js";

const run = promisify(execFile);
const service = `openstrap-test-${process.pid}`;
const store = new KeychainSecretStore(service);

describe("SSH key pair", () => {
  it("writes the public half in the one-line OpenSSH form a guest accepts", () => {
    const pair = new SSHKeyPair().generate("openstrap@ubuntu-vm");

    expect(pair.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/]+=* openstrap@ubuntu-vm$/);
    expect(pair.publicKey.split("\n")).toHaveLength(1);
  });

  it("encodes the algorithm name inside the key blob, as the wire format requires", () => {
    const pair = new SSHKeyPair().generate("openstrap");
    const blob = Buffer.from(pair.publicKey.split(" ")[1]!, "base64");

    expect(blob.readUInt32BE(0)).toBe(11);
    expect(blob.subarray(4, 15).toString("ascii")).toBe("ssh-ed25519");
    expect(blob.readUInt32BE(15)).toBe(32);
  });

  it("writes the private half in the OpenSSH format clients accept", () => {
    const pair = new SSHKeyPair().generate("openstrap");

    expect(pair.privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----\n")).toBe(true);
    expect(pair.privateKey.trimEnd().endsWith("-----END OPENSSH PRIVATE KEY-----")).toBe(true);

    const body = Buffer.from(pair.privateKey.split("\n").slice(1, -2).join(""), "base64");

    expect(body.subarray(0, 15).toString("ascii")).toBe("openssh-key-v1\0");
  });

  it("keeps the private half out of the public half", () => {
    const pair = new SSHKeyPair().generate("openstrap");

    expect(pair.privateKey).toContain("PRIVATE KEY");
    expect(pair.publicKey).not.toContain("PRIVATE");
  });

  it("does not generate the same key twice", () => {
    const generator = new SSHKeyPair();

    expect(generator.generate("a").publicKey).not.toBe(generator.generate("a").publicKey);
  });
});

describe("Keychain secret store", () => {
  afterEach(async () => {
    await run("security", ["delete-generic-password", "-s", service]).catch(() => undefined);
  });

  it("returns nothing for a secret it never stored", async () => {
    expect(await store.read(store.reference("absent"))).toBeNull();
  });

  it("gives back exactly what was stored, newlines and all", async () => {
    const reference = store.reference("ubuntu-vm");
    const key = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIA==\n-----END PRIVATE KEY-----\n";

    await store.write(reference, key);

    expect(await store.read(reference)).toBe(key);
  });

  it("replaces a secret rather than storing a second one", async () => {
    const reference = store.reference("ubuntu-vm");

    await store.write(reference, "first");
    await store.write(reference, "second");

    expect(await store.read(reference)).toBe("second");
  });

  it("forgets a secret when told to", async () => {
    const reference = store.reference("ubuntu-vm");

    await store.write(reference, "value");
    await store.remove(reference);

    expect(await store.read(reference)).toBeNull();
  });

  it("does not fail removing a secret that is not there", async () => {
    await expect(store.remove(store.reference("absent"))).resolves.toBeUndefined();
  });
});
