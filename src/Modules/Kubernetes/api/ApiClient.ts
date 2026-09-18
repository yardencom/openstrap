import { request } from "node:https";
import type { Kubeconfig } from "../cluster/Kubeconfig.js";
import type { KubernetesObject } from "#types/Kubernetes.js";
import { KubernetesApiError } from "../errors/KubernetesApiError.js";
import { ServicesNotReadyError } from "../errors/ServicesNotReadyError.js";
import { UnknownKindError } from "../errors/UnknownKindError.js";

type Answer = { status: number; body: string };

type Deployment = { spec?: { replicas?: number }; status?: { readyReplicas?: number } };

type PodList = {
  items?: Array<{
    status?: {
      phase?: string;
      containerStatuses?: Array<{ state?: { waiting?: { reason?: string; message?: string }; terminated?: { reason?: string } } }>;
    };
  }>;
};

/** The cluster's API spoken to the way kubectl speaks to it, with the certificate its kubeconfig carries. */
export class ApiClient {
  private static readonly kept: Record<string, string> = {
    Deployment: "deployments",
    Service: "services",
    Secret: "secrets",
    PersistentVolumeClaim: "persistentvolumeclaims",
  };

  constructor(
    private readonly kubeconfig: Kubeconfig,
    private readonly namespace = "default",
    private readonly pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /** Told to the cluster as its own to keep: created where absent, brought in line where present. */
  async apply(object: KubernetesObject): Promise<void> {
    const path = `${ApiClient.pathOf(object, this.namespace)}?fieldManager=openstrap&force=true`;
    const answer = await this.send("PATCH", path, JSON.stringify(object), "application/apply-patch+yaml");

    if (answer.status >= 300) {
      throw new KubernetesApiError(answer.status, `${object.kind.toLowerCase()} "${object.metadata.name}"`, answer.body);
    }
  }

  async read(path: string): Promise<unknown> {
    const answer = await this.send("GET", path);

    if (answer.status === 404) {
      return null;
    }

    if (answer.status >= 300) {
      throw new KubernetesApiError(answer.status, path, answer.body);
    }

    return JSON.parse(answer.body) as unknown;
  }

  /** Every named deployment with as many pods answering as it asked for, or the reasons they are not. */
  async waitUntilReady(names: readonly string[], withinMs: number): Promise<void> {
    const deadline = Date.now() + withinMs;
    let waiting = [...names];

    while (waiting.length > 0) {
      const states = await Promise.all(waiting.map(async (name) => [name, await this.isReady(name)] as const));
      waiting = states.filter(([, ready]) => !ready).map(([name]) => name);

      if (waiting.length === 0) {
        return;
      }

      if (Date.now() >= deadline) {
        throw new ServicesNotReadyError(Object.fromEntries(await Promise.all(waiting.map(async (name) => [name, await this.why(name)] as const))));
      }

      await this.pause(3_000);
    }
  }

  static pathOf(object: KubernetesObject, namespace: string): string {
    const plural = ApiClient.kept[object.kind];

    if (plural === undefined) {
      throw new UnknownKindError(object.kind);
    }

    const group = object.apiVersion === "v1" ? "/api/v1" : `/apis/${object.apiVersion}`;

    return `${group}/namespaces/${object.metadata.namespace ?? namespace}/${plural}/${object.metadata.name}`;
  }

  static isReady(deployment: Deployment | null): boolean {
    return deployment !== null && (deployment.status?.readyReplicas ?? 0) >= (deployment.spec?.replicas ?? 1);
  }

  static reasonIn(pods: PodList | null): string {
    const statuses = (pods?.items ?? []).flatMap((pod) => pod.status?.containerStatuses ?? []);
    const waiting = statuses.map((status) => status.state?.waiting).find((state) => state?.reason !== undefined);

    if (waiting) {
      return `${waiting.reason}${waiting.message ? `: ${waiting.message}` : ""}`;
    }

    const terminated = statuses.map((status) => status.state?.terminated).find((state) => state?.reason !== undefined);

    if (terminated) {
      return terminated.reason!;
    }

    const phases = (pods?.items ?? []).map((pod) => pod.status?.phase).filter((phase) => phase !== undefined);

    return phases.length === 0 ? "no pod was started for it" : `pod ${phases.join(", ")}, not yet answering`;
  }

  private async isReady(name: string): Promise<boolean> {
    return ApiClient.isReady(await this.read(`/apis/apps/v1/namespaces/${this.namespace}/deployments/${name}`) as Deployment | null);
  }

  private async why(name: string): Promise<string> {
    return ApiClient.reasonIn(await this.read(`/api/v1/namespaces/${this.namespace}/pods?labelSelector=app%3D${name}`) as PodList | null);
  }

  private send(method: string, path: string, body?: string, contentType?: string): Promise<Answer> {
    const url = new URL(path, this.kubeconfig.server);

    return new Promise<Answer>((resolve, reject) => {
      const sent = request(url, {
        method,
        ca: this.kubeconfig.ca,
        cert: this.kubeconfig.cert,
        key: this.kubeconfig.key,
        headers: {
          accept: "application/json",
          ...(contentType === undefined ? {} : { "content-type": contentType }),
          ...(body === undefined ? {} : { "content-length": Buffer.byteLength(body) }),
        },
      }, (response) => {
        let answer = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          answer += chunk;
        });
        response.once("end", () => resolve({ status: response.statusCode ?? 0, body: answer }));
      });
      sent.once("error", reject);
      sent.end(body);
    });
  }
}
