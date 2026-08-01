import { readFileSync } from "node:fs";

import si from "systeminformation";

import type { FactSections, Network, NetworkInterface, PortFact } from "#types/Facts.js";

/** How this machine is reachable, and what is listening on it. */
export class NetworkFacts {
  async network(declared: Record<string, never> | undefined): Promise<FactSections["network"]> {
    if (declared === undefined) {
      return undefined;
    }

    const [interfaces, connections] = await Promise.all([si.networkInterfaces(), si.networkConnections()]);

    return this.reported(interfaces, connections);
  }

  private reported(
    interfaces: si.Systeminformation.NetworkInterfacesData[] | si.Systeminformation.NetworkInterfacesData,
    connections: si.Systeminformation.NetworkConnectionsData[],
  ): Network {
    const list = Array.isArray(interfaces) ? interfaces : [interfaces];

    return {
      interfaces: Object.fromEntries(list.map((entry) => [entry.iface, this.networkInterface(entry)])),
      dns: this.resolver(),
      ports: this.listeningPorts(connections),
      firewall: { status: "unknown", reason: "not_read" },
      reachability: {},
    };
  }

  private networkInterface(entry: si.Systeminformation.NetworkInterfacesData): NetworkInterface {
    const addresses = [
      entry.ip4 ? { ip: entry.ip4, family: "ipv4", prefix: prefixOf(entry.ip4subnet) } : undefined,
      entry.ip6 ? { ip: entry.ip6, family: "ipv6" } : undefined,
    ].filter((address): address is { ip: string; family: string; prefix?: number } => address !== undefined);

    return {
      name: entry.iface,
      type: entry.type,
      mac: entry.mac || undefined,
      state: entry.operstate,
      mtu: entry.mtu ?? undefined,
      addresses,
    };
  }

/**
   * Which ports are being listened on, keyed by protocol and port.
   *
   * A requirement asks "is something listening on 22", so the key has to be the
   * thing asked about. Both address families answer under the same key when they
   * listen on the same port, which is what a caller means by "port 22 is open".
   */
  private listeningPorts(connections: si.Systeminformation.NetworkConnectionsData[]): Record<string, PortFact> {
    const ports: Record<string, PortFact> = {};

    for (const connection of connections) {
      if (connection.state !== "LISTEN") {
        continue;
      }

      const protocol = connection.protocol.startsWith("udp") ? "udp" : "tcp";
      const port = Number(connection.localPort);

      if (!Number.isInteger(port)) {
        continue;
      }

      ports[`${protocol}/${port}`] = {
        status: "present",
        protocol,
        port,
        state: "listening",
        bind: connection.localAddress,
        process: connection.process || undefined,
      };
    }

    return ports;
  }

/**
   * The resolver configuration, read from the file that holds it.
   *
   * `/etc/resolv.conf` is generated on both Linux and macOS, and reading it is
   * the only way to learn the resolvers without asking a program. A machine
   * without one is answered with no resolvers rather than with a failure: no
   * resolver configuration is a legitimate state.
   */
  private resolver(): Network["dns"] {
    let content: string;

    try {
      content = readFileSync("/etc/resolv.conf", "utf8");
    } catch {
      return {};
    }

    const resolvers: string[] = [];
    const search: string[] = [];
    let domain: string | undefined;

    for (const line of content.split("\n")) {
      const [keyword, ...values] = line.trim().split(/\s+/);

      if (keyword === "nameserver" && values[0]) {
        resolvers.push(values[0]);
      }

      if (keyword === "search") {
        search.push(...values);
      }

      if (keyword === "domain" && values[0]) {
        domain = values[0];
      }
    }

    return { resolvers, search, domain };
  }
}

/** `255.255.255.0` is a prefix of 24; a mask nobody reported is no prefix. */
function prefixOf(mask: string | undefined): number | undefined {
  if (!mask) {
    return undefined;
  }

  const octets = mask.split(".").map(Number);

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }

  return octets.reduce((bits, octet) => bits + octet.toString(2).split("1").length - 1, 0);
}
