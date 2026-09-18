export class KubeconfigUnreadableError extends Error {
  constructor(reason: string) {
    super(`the cluster's kubeconfig could not be read: ${reason}`);
    this.name = "KubeconfigUnreadableError";
  }
}
