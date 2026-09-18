import { describe, expect, it } from "vitest";
import { Blueprints } from "../index.js";
import { BlueprintReadError } from "../errors/BlueprintReadError.js";

const blueprints = new Blueprints();

const written = `
targets:
  shop:
    provider: utm
    image: cloud-image/ubuntu-24.04
    registries:
      ghcr.io:
        username: someone
        password: github.packages-read
    services:
      postgres:
        image: postgres:17-alpine
        port: 5432
        environment: { POSTGRES_DB: shop }
        secrets: { POSTGRES_PASSWORD: shop.database-password }
        storage: /var/lib/postgresql/data
      web:
        image: ghcr.io/someone/shop:1.0.0
        port: 8080
        public: true
        environment:
          DATABASE_URL: postgres://shop:\${POSTGRES_PASSWORD}@postgres:5432/shop
        secrets: { POSTGRES_PASSWORD: shop.database-password }
`;

describe("A blueprint that says what runs on the machine", () => {
  it("carries the services and registries as written", () => {
    const target = blueprints.load({ content: written }).targets.shop!;

    expect(Object.keys(target.services!)).toEqual(["postgres", "web"]);
    expect(target.services!.web).toMatchObject({ image: "ghcr.io/someone/shop:1.0.0", port: 8080, public: true });
    expect(target.services!.web!.environment!.DATABASE_URL).toBe("postgres://shop:${POSTGRES_PASSWORD}@postgres:5432/shop");
    expect(target.registries).toEqual({ "ghcr.io": { username: "someone", password: "github.packages-read" } });
  });

  it("says nothing about how they run, so the words for that are refused", () => {
    expect(() => blueprints.load({ content: written.replace("registries:", "deliver: { k8s: /home/k8s }\n    registries:") }))
      .toThrow(BlueprintReadError);
    expect(() => blueprints.load({ content: written.replace("provider: utm", "provider: utm\n    kubernetes: k3s") }))
      .toThrow(BlueprintReadError);
  });

  it("requires of the machine what running them needs: a cluster, and each public port answering", () => {
    const target = blueprints.load({ content: written }).targets.shop!;

    expect(target.requirements.map((requirement) => requirement.id)).toEqual(["kubernetes", "web-answering"]);
    expect(target.requirements[0]).toMatchObject({
      services: { k3s: { status: "present", running: true, enabled: true } },
      network: { ports: { "tcp/6443": { state: "listening" } } },
    });
    expect(target.requirements[1]).toEqual({
      id: "web-answering",
      network: { ports: { "tcp/8080": { status: "present", reachable: true } } },
    });
  });

  it("requires nothing of a machine with no services", () => {
    const target = blueprints.load({ content: "targets:\n  plain:\n    provider: utm\n" }).targets.plain!;

    expect(target.requirements).toEqual([]);
    expect(target.services).toBeUndefined();
  });

  it("refuses a public service that does not say which port it answers on", () => {
    expect(() => blueprints.load({ content: written.replace("port: 8080\n        public: true", "public: true") }))
      .toThrow(/which port it answers on/);
  });

  it("refuses a service name other services could not reach", () => {
    expect(() => blueprints.load({ content: written.replace("      web:", "      Web_App:") }))
      .toThrow(/Web_App/);
  });

  it("refuses storage that is not a path inside the container", () => {
    expect(() => blueprints.load({ content: written.replace("storage: /var/lib/postgresql/data", "storage: data") }))
      .toThrow(/absolute path/);
  });
});
