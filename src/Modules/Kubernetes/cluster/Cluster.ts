import type { Transport } from "@openstrap/plugin-contract";
import { ClusterInstallError } from "../errors/ClusterInstallError.js";
import { ClusterNotReadyError } from "../errors/ClusterNotReadyError.js";
import { Kubeconfig } from "./Kubeconfig.js";
import { KubeconfigUnreadableError } from "../errors/KubeconfigUnreadableError.js";

/** A single-node k3s cluster on the machine at the other end of a transport. */
export class Cluster {
  private static readonly installer = "curl -sfL https://get.k3s.io | sudo sh -";
  private static readonly kubeconfigPath = "/etc/rancher/k3s/k3s.yaml";

  constructor(
    private readonly transport: Transport,
    private readonly readyWithinMs = 180_000,
    private readonly pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  present(): Promise<boolean> {
    return this.transport.processes.succeeds({
      command: "systemctl",
      args: ["is-active", "--quiet", "k3s"],
      cwd: "/",
      stdio: "ignore",
    });
  }

  async install(): Promise<void> {
    const result = await this.transport.processes.capture({
      command: "sh",
      args: ["-c", Cluster.installer],
      cwd: "/tmp",
    });

    if (result.exitCode !== 0) {
      throw new ClusterInstallError(result.stderr || result.stdout);
    }

    await this.ready();
  }

  async ready(): Promise<void> {
    const deadline = Date.now() + this.readyWithinMs;

    while (Date.now() < deadline) {
      if (await this.answers()) {
        return;
      }

      await this.pause(3_000);
    }

    throw new ClusterNotReadyError(this.readyWithinMs);
  }

  async kubeconfig(): Promise<Kubeconfig> {
    const result = await this.transport.processes.capture({
      command: "sudo",
      args: ["cat", Cluster.kubeconfigPath],
      cwd: "/",
    });

    if (result.exitCode !== 0) {
      throw new KubeconfigUnreadableError(result.stderr.trim() || `exit ${result.exitCode}`);
    }

    return Kubeconfig.parse(result.stdout);
  }

  private answers(): Promise<boolean> {
    return this.transport.processes.succeeds({
      command: "sudo",
      args: ["k3s", "kubectl", "get", "--raw", "/readyz"],
      cwd: "/",
      stdio: "ignore",
    });
  }
}
