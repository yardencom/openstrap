import type { DeclaredService, Registry } from "#types/Services.js";
import type { KubernetesObject } from "#types/Kubernetes.js";
import { MissingSecretError } from "../errors/MissingSecretError.js";

type Environment = Array<{ name: string; value: string } | { name: string; valueFrom: { secretKeyRef: { name: string; key: string } } }>;

/** What a cluster is told so that declared services run on it. */
export class Manifests {
  private static readonly labels = { "app.kubernetes.io/managed-by": "openstrap" };

  constructor(
    private readonly services: Readonly<Record<string, DeclaredService>>,
    private readonly registries: Readonly<Record<string, Registry>> = {},
    private readonly values: Readonly<Record<string, string>> = {},
  ) {}

  objects(): KubernetesObject[] {
    return [
      ...Object.entries(this.registries).map(([host, registry]) => this.login(host, registry)),
      ...Object.entries(this.services).flatMap(([name, service]) => this.ofService(name, service)),
    ];
  }

  static pullSecretName(host: string): string {
    return `registry-${host.replace(/[^a-z0-9-]/g, "-")}`;
  }

  /** The registry an image is pulled from, by the rule docker uses: a first segment with a dot or a colon. */
  static hostOf(image: string): string | undefined {
    const first = image.split("/")[0]!;

    return image.includes("/") && (first.includes(".") || first.includes(":") || first === "localhost") ? first : undefined;
  }

  private ofService(name: string, service: DeclaredService): KubernetesObject[] {
    const secrets = Object.entries(service.secrets ?? {});
    const objects: KubernetesObject[] = [];

    if (secrets.length > 0) {
      objects.push(this.named("v1", "Secret", name, {
        type: "Opaque",
        stringData: Object.fromEntries(secrets.map(([variable, secret]) => [variable, this.value(secret)])),
      }));
    }

    if (service.storage !== undefined) {
      objects.push(this.named("v1", "PersistentVolumeClaim", `${name}-data`, {
        spec: { accessModes: ["ReadWriteOnce"], resources: { requests: { storage: "1Gi" } } },
      }));
    }

    objects.push(this.deployment(name, service));

    if (service.port !== undefined) {
      objects.push(this.named("v1", "Service", name, {
        spec: {
          type: service.public ? "LoadBalancer" : "ClusterIP",
          selector: { app: name },
          ports: [{ name: "main", port: service.port, targetPort: service.port }],
        },
      }));
    }

    return objects;
  }

  private deployment(name: string, service: DeclaredService): KubernetesObject {
    const host = Manifests.hostOf(service.image);
    const pull = host !== undefined && host in this.registries ? [{ name: Manifests.pullSecretName(host) }] : [];
    const port = service.port === undefined ? {} : {
      ports: [{ name: "main", containerPort: service.port }],
      readinessProbe: { tcpSocket: { port: service.port }, initialDelaySeconds: 2, periodSeconds: 5 },
    };
    const storage = service.storage === undefined ? { mounts: {}, volumes: {} } : {
      mounts: { volumeMounts: [{ name: "data", mountPath: service.storage }] },
      volumes: { volumes: [{ name: "data", persistentVolumeClaim: { claimName: `${name}-data` } }] },
    };

    return this.named("apps/v1", "Deployment", name, {
      spec: {
        replicas: 1,
        strategy: { type: "Recreate" },
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name, ...Manifests.labels } },
          spec: {
            ...(pull.length === 0 ? {} : { imagePullSecrets: pull }),
            containers: [{
              name,
              image: service.image,
              env: Manifests.environment(name, service),
              ...port,
              ...storage.mounts,
            }],
            ...storage.volumes,
          },
        },
      },
    });
  }

  /** Secrets first, so a plain value may refer to one: `${NAME}` as compose writes it, `$(NAME)` as the cluster reads it. */
  private static environment(name: string, service: DeclaredService): Environment {
    return [
      ...Object.keys(service.secrets ?? {}).map((variable) => ({
        name: variable,
        valueFrom: { secretKeyRef: { name, key: variable } },
      })),
      ...Object.entries(service.environment ?? {}).map(([variable, value]) => ({
        name: variable,
        value: value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, "$($1)"),
      })),
    ];
  }

  private login(host: string, registry: Registry): KubernetesObject {
    const password = this.value(registry.password);
    const auth = Buffer.from(`${registry.username}:${password}`, "utf8").toString("base64");

    return this.named("v1", "Secret", Manifests.pullSecretName(host), {
      type: "kubernetes.io/dockerconfigjson",
      stringData: {
        ".dockerconfigjson": JSON.stringify({ auths: { [host]: { username: registry.username, password, auth } } }),
      },
    });
  }

  private value(secret: string): string {
    const value = this.values[secret];

    if (value === undefined) {
      throw new MissingSecretError(secret);
    }

    return value;
  }

  private named(apiVersion: string, kind: string, name: string, rest: Record<string, unknown>): KubernetesObject {
    return { apiVersion, kind, metadata: { name, labels: { ...Manifests.labels } }, ...rest };
  }
}
