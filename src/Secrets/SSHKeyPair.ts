import { generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";

export type GeneratedKeyPair = {
  /** OpenSSH private key format. Never leaves the secret store. */
  privateKey: string;
  /** OpenSSH one-line form, the only half that reaches a guest. */
  publicKey: string;
};

/**
 * Generates the key pair a managed user logs in with.
 *
 * Both halves are written in OpenSSH's own formats by hand rather than by
 * pulling in a library. PKCS#8, which node produces natively, is not accepted
 * by SSH clients, and a dependency for this would have to survive being
 * bundled into a single binary.
 */
export class SSHKeyPair {
  generate(comment: string): GeneratedKeyPair {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const seed = rawKey(privateKey.export({ format: "der", type: "pkcs8" }));
    const key = rawKey(publicKey.export({ format: "der", type: "spki" }));

    return {
      privateKey: openSshPrivateKey(seed, key, comment),
      publicKey: `ssh-ed25519 ${publicKeyBlob(key).toString("base64")} ${comment}`,
    };
  }
}

/** For ed25519 both DER encodings end with the 32 raw bytes. */
function rawKey(der: Buffer): Buffer {
  return der.subarray(der.length - 32);
}

function publicKeyBlob(key: Buffer): Buffer {
  return Buffer.concat([
    lengthPrefixed(Buffer.from("ssh-ed25519", "ascii")),
    lengthPrefixed(key),
  ]);
}

function openSshPrivateKey(seed: Buffer, key: Buffer, comment: string): string {
  const check = randomBytes(4);
  const unpadded = Buffer.concat([
    check,
    check,
    lengthPrefixed(Buffer.from("ssh-ed25519", "ascii")),
    lengthPrefixed(key),
    lengthPrefixed(Buffer.concat([seed, key])),
    lengthPrefixed(Buffer.from(comment, "utf8")),
  ]);

  const body = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "ascii"),
    lengthPrefixed(Buffer.from("none", "ascii")),
    lengthPrefixed(Buffer.from("none", "ascii")),
    lengthPrefixed(Buffer.alloc(0)),
    uint32(1),
    lengthPrefixed(publicKeyBlob(key)),
    lengthPrefixed(Buffer.concat([unpadded, padding(unpadded.length)])),
  ]);

  return [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    ...(body.toString("base64").match(/.{1,70}/g) ?? []),
    "-----END OPENSSH PRIVATE KEY-----",
    "",
  ].join("\n");
}

/** The private section is padded to the cipher block size with 1, 2, 3, … */
function padding(length: number): Buffer {
  const size = (8 - (length % 8)) % 8;

  return Buffer.from(Array.from({ length: size }, (_value, index) => index + 1));
}

function lengthPrefixed(value: Buffer): Buffer {
  return Buffer.concat([uint32(value.length), value]);
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);

  return buffer;
}
