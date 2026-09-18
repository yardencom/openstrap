import { describe, expect, it } from "vitest";
import { Kubeconfig, KubeconfigUnreadableError } from "../index.js";

const ca = Buffer.from("ca-pem").toString("base64");
const cert = Buffer.from("cert-pem").toString("base64");
const key = Buffer.from("key-pem").toString("base64");
const written = `
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${ca}
    server: https://127.0.0.1:6443
  name: default
contexts:
- context: { cluster: default, user: default }
  name: default
current-context: default
kind: Config
users:
- name: default
  user:
    client-certificate-data: ${cert}
    client-key-data: ${key}
`;

describe("The kubeconfig k3s writes", () => {
  it("is read for the address and the three parts of the certificate", () => {
    const kubeconfig = Kubeconfig.parse(written);

    expect(kubeconfig.server).toBe("https://127.0.0.1:6443");
    expect(kubeconfig.ca.toString()).toBe("ca-pem");
    expect(kubeconfig.cert.toString()).toBe("cert-pem");
    expect(kubeconfig.key.toString()).toBe("key-pem");
  });

  it("can be pointed at another address without losing the certificate, which is what a tunnel needs", () => {
    const moved = Kubeconfig.parse(written).withServer("https://127.0.0.1:50123");

    expect(moved.server).toBe("https://127.0.0.1:50123");
    expect(moved.key.toString()).toBe("key-pem");
  });

  it("says which part is missing rather than failing later at the cluster", () => {
    expect(() => Kubeconfig.parse(written.replace(/client-key-data:.*\n/, ""))).toThrow(/client key is missing/);
    expect(() => Kubeconfig.parse("not: [valid")).toThrow(KubeconfigUnreadableError);
  });
});
