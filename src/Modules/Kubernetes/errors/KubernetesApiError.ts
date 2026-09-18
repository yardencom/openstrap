export class KubernetesApiError extends Error {
  constructor(readonly status: number, what: string, said: string) {
    super(`the cluster refused ${what}: ${status} ${KubernetesApiError.messageIn(said)}`);
    this.name = "KubernetesApiError";
  }

  private static messageIn(said: string): string {
    try {
      const parsed = JSON.parse(said) as { message?: unknown };

      return typeof parsed.message === "string" ? parsed.message : said.slice(0, 200);
    } catch {
      return said.slice(0, 200);
    }
  }
}
