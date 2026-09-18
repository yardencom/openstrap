import { parse } from "yaml";
import { KubeconfigUnreadableError } from "../errors/KubeconfigUnreadableError.js";

type Written = {
  clusters?: Array<{ cluster?: { server?: unknown; "certificate-authority-data"?: unknown } }>;
  users?: Array<{ user?: { "client-certificate-data"?: unknown; "client-key-data"?: unknown } }>;
};

/** The address of a cluster and the certificate it lets in, as k3s writes them. */
export class Kubeconfig {
  private constructor(
    readonly server: string,
    readonly ca: Buffer,
    readonly cert: Buffer,
    readonly key: Buffer,
  ) {}

  static parse(text: string): Kubeconfig {
    let written: Written;

    try {
      written = parse(text) as Written;
    } catch (error) {
      throw new KubeconfigUnreadableError(error instanceof Error ? error.message : String(error));
    }

    const cluster = written?.clusters?.[0]?.cluster;
    const user = written?.users?.[0]?.user;

    return new Kubeconfig(
      Kubeconfig.text(cluster?.server, "the server address"),
      Kubeconfig.encoded(cluster?.["certificate-authority-data"], "the certificate authority"),
      Kubeconfig.encoded(user?.["client-certificate-data"], "the client certificate"),
      Kubeconfig.encoded(user?.["client-key-data"], "the client key"),
    );
  }

  /** The same cluster spoken to at another address, which is what a tunnel gives it. */
  withServer(server: string): Kubeconfig {
    return new Kubeconfig(server, this.ca, this.cert, this.key);
  }

  private static text(value: unknown, what: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new KubeconfigUnreadableError(`${what} is missing`);
    }

    return value;
  }

  private static encoded(value: unknown, what: string): Buffer {
    return Buffer.from(Kubeconfig.text(value, what), "base64");
  }
}
