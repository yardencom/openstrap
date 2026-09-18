import { describe, expect, it } from "vitest";
import { ApiClient } from "../index.js";

describe("Where the cluster keeps things", () => {
  it("is under the core API for the kinds that predate groups, and under the group otherwise", () => {
    expect(ApiClient.pathOf({ apiVersion: "v1", kind: "Secret", metadata: { name: "web" } }, "default"))
      .toBe("/api/v1/namespaces/default/secrets/web");
    expect(ApiClient.pathOf({ apiVersion: "apps/v1", kind: "Deployment", metadata: { name: "web" } }, "default"))
      .toBe("/apis/apps/v1/namespaces/default/deployments/web");
    expect(ApiClient.pathOf({ apiVersion: "v1", kind: "PersistentVolumeClaim", metadata: { name: "d", namespace: "shop" } }, "default"))
      .toBe("/api/v1/namespaces/shop/persistentvolumeclaims/d");
  });

  it("refuses a kind it has no address for", () => {
    expect(() => ApiClient.pathOf({ apiVersion: "v1", kind: "Node", metadata: { name: "n" } }, "default")).toThrow(/Node/);
  });
});

describe("Whether a service is ready", () => {
  it("is as many pods answering as were asked for", () => {
    expect(ApiClient.isReady({ spec: { replicas: 1 }, status: { readyReplicas: 1 } })).toBe(true);
    expect(ApiClient.isReady({ spec: { replicas: 1 }, status: {} })).toBe(false);
    expect(ApiClient.isReady(null)).toBe(false);
  });

  it("is explained by what the pod is waiting on, which is what a person would look for", () => {
    expect(ApiClient.reasonIn({ items: [{ status: { phase: "Pending", containerStatuses: [{ state: { waiting: { reason: "ImagePullBackOff", message: "unauthorized" } } }] } }] }))
      .toBe("ImagePullBackOff: unauthorized");
    expect(ApiClient.reasonIn({ items: [{ status: { phase: "Running", containerStatuses: [{ state: { terminated: { reason: "Error" } } }] } }] }))
      .toBe("Error");
    expect(ApiClient.reasonIn({ items: [{ status: { phase: "Pending" } }] })).toBe("pod Pending, not yet answering");
    expect(ApiClient.reasonIn({ items: [] })).toBe("no pod was started for it");
  });
});
