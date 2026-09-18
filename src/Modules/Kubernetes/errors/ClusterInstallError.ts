export class ClusterInstallError extends Error {
  constructor(said: string) {
    super(`installing the cluster failed: ${said.trim().split("\n").slice(-3).join(" | ") || "the installer said nothing"}`);
    this.name = "ClusterInstallError";
  }
}
