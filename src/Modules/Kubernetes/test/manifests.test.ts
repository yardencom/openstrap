import { describe, expect, it } from "vitest";
import { Manifests, MissingSecretError } from "../index.js";
import type { KubernetesObject } from "../index.js";

const services = {
  postgres: {
    image: "postgres:17-alpine",
    port: 5432,
    environment: { POSTGRES_DB: "shop", PGDATA: "/var/lib/postgresql/data/pgdata" },
    secrets: { POSTGRES_PASSWORD: "shop.database-password" },
    storage: "/var/lib/postgresql/data",
  },
  web: {
    image: "ghcr.io/someone/shop:1.0.0",
    port: 8080,
    public: true,
    environment: { DATABASE_URL: "postgres://shop:${POSTGRES_PASSWORD}@postgres:5432/shop" },
    secrets: { POSTGRES_PASSWORD: "shop.database-password" },
  },
  worker: {
    image: "ghcr.io/someone/worker:1.0.0",
  },
};
const registries = { "ghcr.io": { username: "someone", password: "github.packages-read" } };
const values = { "shop.database-password": "pw", "github.packages-read": "ghp_token" };

type Container = { env?: unknown[]; volumeMounts?: unknown; readinessProbe?: unknown };
type Deployment = {
  spec: { strategy: unknown; template: { spec: { imagePullSecrets?: unknown; volumes?: unknown; containers: Container[] } } };
};
type Secret = { type: string; stringData: Record<string, string> };

function of<T = KubernetesObject>(kind: string, name: string, objects: KubernetesObject[]): T {
  const found = objects.find((object) => object.kind === kind && object.metadata.name === name);
  expect(found, `${kind} ${name}`).toBeDefined();
  return found as unknown as T;
}

describe("What the cluster is told", () => {
  const objects = new Manifests(services, registries, values).objects();

  it("is one deployment per service, a service where it has a port, a claim where it has storage", () => {
    expect(objects.map((object) => `${object.kind}/${object.metadata.name}`)).toEqual([
      "Secret/registry-ghcr-io",
      "Secret/postgres", "PersistentVolumeClaim/postgres-data", "Deployment/postgres", "Service/postgres",
      "Secret/web", "Deployment/web", "Service/web",
      "Deployment/worker",
    ]);
  });

  it("publishes a public port on the machine and keeps the rest to the other services", () => {
    expect(of("Service", "web", objects)).toMatchObject({ spec: { type: "LoadBalancer", ports: [{ port: 8080, targetPort: 8080 }] } });
    expect(of("Service", "postgres", objects)).toMatchObject({ spec: { type: "ClusterIP", ports: [{ port: 5432 }] } });
  });

  it("hands a secret to its container by reference and never writes the value beside plain values", () => {
    const container = of<Deployment>("Deployment", "web", objects).spec.template.spec.containers[0]!;

    expect(container.env).toEqual([
      { name: "POSTGRES_PASSWORD", valueFrom: { secretKeyRef: { name: "web", key: "POSTGRES_PASSWORD" } } },
      { name: "DATABASE_URL", value: "postgres://shop:$(POSTGRES_PASSWORD)@postgres:5432/shop" },
    ]);
    expect(of("Secret", "web", objects)).toMatchObject({ type: "Opaque", stringData: { POSTGRES_PASSWORD: "pw" } });
  });

  it("logs in to a registry for the images that come from it, and only those", () => {
    const login = of<Secret>("Secret", "registry-ghcr-io", objects);
    expect(login).toMatchObject({ type: "kubernetes.io/dockerconfigjson" });
    expect(JSON.parse(login.stringData[".dockerconfigjson"]!)).toEqual({
      auths: { "ghcr.io": { username: "someone", password: "ghp_token", auth: Buffer.from("someone:ghp_token").toString("base64") } },
    });

    const pulls = (name: string) => of<Deployment>("Deployment", name, objects).spec.template.spec.imagePullSecrets;
    expect(pulls("web")).toEqual([{ name: "registry-ghcr-io" }]);
    expect(pulls("worker")).toEqual([{ name: "registry-ghcr-io" }]);
    expect(pulls("postgres")).toBeUndefined();
  });

  it("keeps storage across restarts by a claim, and restarts by replacing so the claim is never wanted twice", () => {
    const deployment = of<Deployment>("Deployment", "postgres", objects);
    expect(deployment.spec.strategy).toEqual({ type: "Recreate" });
    expect(deployment.spec.template.spec.volumes).toEqual([{ name: "data", persistentVolumeClaim: { claimName: "postgres-data" } }]);
    expect(deployment.spec.template.spec.containers[0]!.volumeMounts).toEqual([{ name: "data", mountPath: "/var/lib/postgresql/data" }]);
  });

  it("calls a service ready when its port accepts a connection, which is the one thing every service has", () => {
    const container = of<Deployment>("Deployment", "web", objects).spec.template.spec.containers[0]!;
    expect(container.readinessProbe).toMatchObject({ tcpSocket: { port: 8080 } });
  });

  it("refuses to describe a secret it was not given the value of", () => {
    expect(() => new Manifests(services, registries, { "shop.database-password": "pw" }).objects()).toThrow(MissingSecretError);
  });

  it("rolls a service whose image means the newest on every run, and leaves a version alone", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const rolled = new Manifests({
      newest: { image: "ghcr.io/someone/shop:latest" },
      untagged: { image: "ghcr.io/someone/shop" },
      pinned: { image: "ghcr.io/someone/shop:1.0.0" },
      digested: { image: "ghcr.io/someone/shop@sha256:" + "a".repeat(64) },
    }, {}, {}, now).objects();
    type Rolled = { spec: { template: { metadata: { annotations?: Record<string, string> }; spec: { containers: Array<{ imagePullPolicy: string }> } } } };
    const annotationsOf = (name: string) => of<Rolled>("Deployment", name, rolled).spec.template.metadata.annotations;
    const pullOf = (name: string) => of<Rolled>("Deployment", name, rolled).spec.template.spec.containers[0]!.imagePullPolicy;

    expect(annotationsOf("newest")).toEqual({ "openstrap.dev/deployed-at": "2026-09-18T12:00:00.000Z" });
    expect(annotationsOf("untagged")).toEqual({ "openstrap.dev/deployed-at": "2026-09-18T12:00:00.000Z" });
    expect(annotationsOf("pinned")).toBeUndefined();
    expect(annotationsOf("digested")).toBeUndefined();
    expect([pullOf("newest"), pullOf("untagged"), pullOf("pinned"), pullOf("digested")]).toEqual(["Always", "Always", "IfNotPresent", "IfNotPresent"]);
    expect(Manifests.moving("localhost:5000/shop")).toBe(true);
    expect(Manifests.moving("localhost:5000/shop:2")).toBe(false);
  });

  it("knows which registry an image comes from the way docker does", () => {
    expect(Manifests.hostOf("ghcr.io/someone/shop:1.0.0")).toBe("ghcr.io");
    expect(Manifests.hostOf("localhost:5000/shop")).toBe("localhost:5000");
    expect(Manifests.hostOf("postgres:17-alpine")).toBeUndefined();
    expect(Manifests.hostOf("library/postgres")).toBeUndefined();
  });
});
