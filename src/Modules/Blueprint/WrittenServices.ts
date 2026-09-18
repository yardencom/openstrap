import type { BlueprintTargetConfig } from "./schema/BlueprintConfig.js";
import type { TargetlessRequirement } from "../Requirements/index.js";

/** What the machine has to be for its services to be running, said as facts a reading can check. */
export class WrittenServices {
  constructor(private readonly target: BlueprintTargetConfig) {}

  requirements(): TargetlessRequirement[] {
    const services = Object.entries(this.target.services ?? {});

    if (services.length === 0) {
      return [];
    }

    return [
      {
        id: "kubernetes",
        services: { k3s: { status: "present", running: true, enabled: true } },
        tools: { kubectl: { status: "present" } },
        network: { ports: { "tcp/6443": { status: "present", state: "listening" } } },
      },
      ...services
        .filter(([, service]) => service.public === true && service.port !== undefined)
        .map(([name, service]) => ({
          id: `${name}-answering`,
          network: { ports: { [`tcp/${service.port}`]: { status: "present", reachable: true } } },
        })),
    ];
  }
}
