import { describe, expect, it } from "vitest";

import {
  RequirementFactCollectionRequestBuilder,
} from "../Application/RequirementFactCollectionRequestBuilder.js";

describe("RequirementFactCollectionRequestBuilder", () => {
  it("builds fact collection requests from requirement-shaped fact selectors", () => {
    const request = new RequirementFactCollectionRequestBuilder().build({
      target: {
        name: "host",
        scope: "host",
        type: "machine",
        transport: "local",
      },
      requirements: [{
        id: "ssh-service",
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
});
