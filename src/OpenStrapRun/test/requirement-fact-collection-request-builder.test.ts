import { describe, expect, it } from "vitest";

import {
  RequirementFactCollectionRequestBuilder,
  RequirementFactCollectionRequestError,
} from "../Application/RequirementFactCollectionRequestBuilder.js";

describe("RequirementFactCollectionRequestBuilder", () => {
  it("builds fact collection requests from requirement-shaped fact selectors", () => {
    const request = new RequirementFactCollectionRequestBuilder().build({
      targets: [{
        name: "host",
        scope: "host",
        type: "machine",
        transport: "local",
      }],
      requirements: [{
        id: "ssh-service",
        target: "host",
        services: {
          ssh: {
            running: true,
          },
        },
      }],
      now: new Date("2026-06-08T10:00:00.000Z"),
    });

    expect(request.targets).toEqual([{
      target: {
        name: "host",
        scope: "host",
        type: "machine",
        transport: "local",
      },
      selectors: {
        services: {
          ssh: {
            running: true,
          },
        },
      },
    }]);
  });

  it("rejects requirements that reference unknown targets", () => {
    expect(() => new RequirementFactCollectionRequestBuilder().build({
      targets: [],
      requirements: [{
        id: "unknown-target",
        target: "host",
        runtimes: {
          node: {
            ready: true,
          },
        },
      }],
    })).toThrow(RequirementFactCollectionRequestError);
  });
});
