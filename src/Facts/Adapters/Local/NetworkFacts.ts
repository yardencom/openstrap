import { networkInterfaces } from "node:os";

import type {
  Network,
  NetworkInterface,
} from "../../Domain/Facts.js";

export function collectNetworkFacts(): Network {
  return {
    interfaces: Object.fromEntries(
      Object.entries(networkInterfaces()).map(([name, addresses]): [string, NetworkInterface] => [
        name,
        {
          name,
          addresses: (addresses ?? []).map((address) => ({
            ip: address.address,
            family: normalizeIpFamily(address.family),
            scope: address.internal ? "internal" : "external",
          })),
        },
      ]),
    ),
    dns: {},
    ports: {},
    firewall: {
      status: "unknown",
      reason: "not_collected",
    },
    reachability: {},
  };
}

function normalizeIpFamily(value: string | number): string {
  return value === 4 || value === "IPv4" ? "ipv4" : value === 6 || value === "IPv6" ? "ipv6" : String(value);
}
