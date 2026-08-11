import { generateKeyPairSync, randomBytes } from "node:crypto";

export type GeneratedKeyPair = {
  privateKey: string;
  /** OpenSSH one-line form, the only half that reaches a guest. */
  publicKey: string;
};

/** Generates the key pair a managed user logs in with. */
export class SSHKeyPair {
  generate(comment: string): GeneratedKeyPair {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const seed = SSHKeyPair.rawKey(privateKey.export({ format: "der", type: "pkcs8" }));
    const key = SSHKeyPair.rawKey(publicKey.export({ format: "der", type: "spki" }));

    return {
      privateKey: SSHKeyPair.openSshPrivateKey(seed, key, comment),
      publicKey: `ssh-ed25519 ${SSHKeyPair.publicKeyBlob(key).toString("base64")} ${comment}`,
    };
  }

  private static rawKey(der: Buffer): Buffer {
    return der.subarray(der.length - 32);
  }

  private static publicKeyBlob(key: Buffer): Buffer {
    return Buffer.concat([
      SSHKeyPair.lengthPrefixed(Buffer.from("ssh-ed25519", "ascii")),
      SSHKeyPair.lengthPrefixed(key),
    ]);
  }

  private static openSshPrivateKey(seed: Buffer, key: Buffer, comment: string): string {
    const check = randomBytes(4);
    const unpadded = Buffer.concat([
      check,
      check,
      SSHKeyPair.lengthPrefixed(Buffer.from("ssh-ed25519", "ascii")),
      SSHKeyPair.lengthPrefixed(key),
      SSHKeyPair.lengthPrefixed(Buffer.concat([seed, key])),
      SSHKeyPair.lengthPrefixed(Buffer.from(comment, "utf8")),
    ]);

    const body = Buffer.concat([
      Buffer.from("openssh-key-v1\0", "ascii"),
      SSHKeyPair.lengthPrefixed(Buffer.from("none", "ascii")),
      SSHKeyPair.lengthPrefixed(Buffer.from("none", "ascii")),
      SSHKeyPair.lengthPrefixed(Buffer.alloc(0)),
      SSHKeyPair.uint32(1),
      SSHKeyPair.lengthPrefixed(SSHKeyPair.publicKeyBlob(key)),
      SSHKeyPair.lengthPrefixed(Buffer.concat([unpadded, SSHKeyPair.padding(unpadded.length)])),
    ]);

    return [
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      ...(body.toString("base64").match(/.{1,70}/g) ?? []),
      "-----END OPENSSH PRIVATE KEY-----",
      "",
    ].join("\n");
  }

  private static padding(length: number): Buffer {
    const size = (8 - (length % 8)) % 8;

    return Buffer.from(Array.from({ length: size }, (_value, index) => index + 1));
  }

  private static lengthPrefixed(value: Buffer): Buffer {
    return Buffer.concat([SSHKeyPair.uint32(value.length), value]);
  }

  private static uint32(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value);

    return buffer;
  }
}

/** For ed25519 both DER encodings end with the 32 raw bytes. */



/** The private section is padded to the cipher block size with 1, 2, 3, … */
