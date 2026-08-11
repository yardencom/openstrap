import type { Asked } from "#types/FactDeclaration.js";
import { connect } from "node:net";
import { readFileSync } from "node:fs";

import si from "systeminformation";

import type { FactSections, Network, NetworkInterface, PortFact } from "#types/Facts.js";

/** How this machine is reachable, and what is listening on it. */
export class NetworkFacts {
  async network(declared: Asked | undefined): Promise<FactSections["network"]> {
    if (declared === undefined) {
      return undefined;
    }

    const [interfaces, connections] = await Promise.all([si.networkInterfaces(), si.networkConnections()]);
    const list = Array.isArray(interfaces) ? interfaces : [interfaces];

    return {
      interfaces: Object.fromEntries(list.map((entry) => [entry.iface, this.networkInterface(entry)])),
      dns: this.resolver(),
      ports: await this.ports(connections, declared.ports),
      firewall: { status: "unknown", reason: "not_read" },
      reachability: {},
    };
  }

  /**
   * The ports of this machine: the ones something is holding, and the ones a requirement named.
   *
   * Two questions, and a machine answers them differently about the same port. A container publishes
   * one with a rule that rewrites the destination and claims nothing on the machine: the socket table
   * is empty for it while a connection is answered. Only named ports are knocked on — trying every
   * port is a port scan.
   */
  private async ports(
    connections: si.Systeminformation.NetworkConnectionsData[],
    asked: unknown,
  ): Promise<Record<string, PortFact>> {
    const ports = this.listeningPorts(connections);

    for (const name of Object.keys(asked !== null && typeof asked === "object" ? asked : {})) {
      const address = NetworkFacts.addressOf(name);

      if (address === undefined || address.protocol !== "tcp") {
        continue;
      }

      const reachable = await NetworkFacts.knock(address.port);
      const held = ports[name];

      ports[name] = held
        ? { ...held, reachable }
        // Nothing is holding it. Reachable anyway means something answered — a rule took the packet
        // somewhere. Not reachable means the port is simply not there, which is an answer too.
        : {
            status: reachable ? "present" : "absent",
            protocol: address.protocol,
            port: address.port,
            reachable,
            ...(reachable ? { state: "reachable" } : { reason: "nothing_holds_it_and_it_does_not_answer" }),
          };
    }

    return ports;
  }

  private networkInterface(entry: si.Systeminformation.NetworkInterfacesData): NetworkInterface {
    const addresses = [
      entry.ip4 ? { ip: entry.ip4, family: "ipv4", prefix: NetworkFacts.prefixOf(entry.ip4subnet) } : undefined,
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

/** Which ports are being listened on, keyed by protocol and port. */
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

/** The resolver configuration, read from the file that holds it. */
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

  private static prefixOf(mask: string | undefined): number | undefined {
    if (!mask) {
      return undefined;
    }

    const octets = mask.split(".").map(Number);

    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return undefined;
    }

    return octets.reduce((bits, octet) => bits + octet.toString(2).split("1").length - 1, 0);
  }

  private static addressOf(name: string): { protocol: string; port: number } | undefined {
    const [protocol, port] = name.split("/");
    const number = Number(port);

    return protocol && Number.isInteger(number) && number > 0 ? { protocol, port: number } : undefined;
  }

  /** Whether a connection to this port of this machine is accepted. */
  private static knock(port: number, timeoutMs = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      const answer = (reachable: boolean) => () => {
        socket.destroy();
        resolve(reachable);
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", answer(true));
      socket.once("error", answer(false));
      socket.once("timeout", answer(false));
    });
  }
}

/** `255.255.255.0` is a prefix of 24; a mask nobody reported is no prefix. */

/** A port as a requirement names it: `tcp/8080`. */
