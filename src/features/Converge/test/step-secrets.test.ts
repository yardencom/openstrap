import { afterEach, describe, expect, it } from "vitest";

import { StepSecrets } from "../application/StepSecrets.js";
import type { SecretStore } from "../../../Plugin/index.js";
import type { Step } from "#types/Step.js";

const variable = "OPENSTRAP_SECRET_OPENSTRAP_SERVER_MASTER_KEY";

afterEach(() => {
  delete process.env[variable];
});

/** A store holding one thing, standing in for a keychain or anything else that implements the same. */
function storeHolding(entries: Record<string, string>): SecretStore {
  return {
    id: "test",
    read: async (reference) => entries[reference.name] ?? null,
    write: async () => {},
    remove: async () => {},
  };
}

function step(secret: string): Step {
  return {
    id: "put-the-key-in-the-cluster",
    requirements: ["the-product-runs"],
    action: { kind: "run", command: "true", args: [], environment: { KEY: { secret } } },
  };
}

describe("where a step's secret comes from", () => {
  it("is the store, on the machine openstrap is installed on", async () => {
    const secrets = new StepSecrets(storeHolding({ "openstrap-server.master-key": "from-the-store" }));

    await expect(secrets.reveal()("openstrap-server.master-key")).resolves.toBe("from-the-store");
  });

  it("is the environment first, which is how it reaches a machine openstrap is not on", async () => {
    // The delivered openstrap has no keychain to ask. The value was fetched where the store is and
    // handed to it as a variable, so this is the same code answering from a different source.
    process.env[variable] = "carried-over";

    const secrets = new StepSecrets(storeHolding({ "openstrap-server.master-key": "from-the-store" }));

    await expect(secrets.reveal()("openstrap-server.master-key")).resolves.toBe("carried-over");
  });

  it("is nothing when neither has it, rather than an empty string", async () => {
    const secrets = new StepSecrets(storeHolding({}));

    await expect(secrets.reveal()("openstrap-server.master-key")).resolves.toBeNull();
  });

  describe("gathered for a machine openstrap is not on", () => {
    it("fetches what the steps named, under the variables the far side will look in", async () => {
      const secrets = new StepSecrets(storeHolding({ "openstrap-server.master-key": "s3cr3t" }));

      await expect(secrets.forDelivery([step("openstrap-server.master-key")]))
        .resolves.toEqual({ [variable]: "s3cr3t" });
    });

    it("carries nothing for a step that wrote its values out", async () => {
      const plain: Step = {
        id: "plain",
        requirements: ["the-product-runs"],
        action: { kind: "run", command: "true", args: [], environment: { WHERE: "/srv" } },
      };

      await expect(new StepSecrets(storeHolding({ any: "thing" })).forDelivery([plain])).resolves.toEqual({});
    });

    it("leaves out a name nothing can answer, so the step says so over there", async () => {
      // Failing here would fail before anything had been read, and would say less: over there the
      // step that wanted it names it.
      await expect(new StepSecrets(storeHolding({})).forDelivery([step("nowhere")])).resolves.toEqual({});
    });
  });
});
