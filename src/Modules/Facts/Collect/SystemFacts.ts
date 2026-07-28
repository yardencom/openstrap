import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { loadavg, userInfo } from "node:os";

import si from "systeminformation";
import which from "which";

import type { FactData, Network, NetworkInterface, PortFact } from "../Domain/FactModel.js";
import type { Platform } from "./Platform.js";

/** A package manager is recognised by the executable that drives it. */
const packageManagers: readonly { name: string; executable: string }[] = [
  { name: "apt", executable: "apt-get" },
  { name: "dnf", executable: "dnf" },
  { name: "yum", executable: "yum" },
  { name: "zypper", executable: "zypper" },
  { name: "pacman", executable: "pacman" },
  { name: "apk", executable: "apk" },
  { name: "brew", executable: "brew" },
  { name: "port", executable: "port" },
];

/**
 * The sections a machine answers with one value each.
 *
 * Nobody asks "is `cpu` present", so unlike the named sections these are read
 * whole and always: they are what a requirement compares against — how much
 * memory there is, which architecture this is, who is running.
 *
 * Every value comes from an API. Nothing here parses the output of a program,
 * with one stated exception: whether `sudo` works without a password cannot be
 * learned from any API, because the only proof that it works is that it worked.
 */
export class SystemFacts {
  constructor(private readonly platform: Platform) {}

  async read(): Promise<Omit<FactData, "processes" | "services" | "transports" | "runtimes" | "paths" | "tools" | "env" | "commands" | "artifacts" | "users" | "groups">> {
    const [operatingSystem, cpu, memory, filesystems, interfaces, connections] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaces(),
      si.networkConnections(),
    ]);

    return {
      os: this.operatingSystem(operatingSystem),
      arch: this.platform.architecture,
      cpu: {
        // Cores are packages of execution, threads are what the scheduler sees.
        // A machine that reports no physical count answers with the logical one
        // rather than with zero, which would read as a broken machine.
        cores: cpu.physicalCores || cpu.cores,
        threads: cpu.cores,
        model: named(`${cpu.manufacturer} ${cpu.brand}`),
        vendor: named(cpu.vendor) ?? named(cpu.manufacturer),
        load: loadavg(),
      },
      memory: {
        totalBytes: memory.total,
        availableBytes: memory.available,
        swapTotalBytes: memory.swaptotal,
        swapUsedBytes: memory.swapused,
      },
      storage: this.storage(filesystems),
      virtualization: this.virtualization(),
      network: this.network(interfaces, connections),
      packages: { managers: await this.packageManagers() },
      privileges: this.privileges(),
    };
  }

  /**
   * Which operating system this is, in the spelling a requirement is written in.
   *
   * On Linux the answer comes from `/etc/os-release`, which is the distribution's
   * own declaration of its identity, because a requirement says `ubuntu 24.04`
   * and that file is the only place those exact strings exist. What a tool prints
   * for a human — `Ubuntu 24.04.4 LTS` — is kept beside them rather than instead
   * of them: comparing against a banner is how a version check starts failing on
   * a point release.
   *
   * macOS has no such file and needs none: the product version is already the
   * version anyone writes down.
   */
  private operatingSystem(reported: si.Systeminformation.OsData): FactData["os"] {
    const declared = this.platform.is("linux") ? osRelease() : new Map<string, string>();
    const pretty = declared.get("PRETTY_NAME") ?? `${reported.distro} ${reported.release}`.trim();

    return {
      family: this.platform.name,
      // Lowercased because a requirement is written against an identifier —
      // `ubuntu` — not against the name a distribution prints on a banner.
      name: this.platform.is("macos") ? "macos" : declared.get("ID") ?? reported.distro.toLowerCase(),
      // Rolling distributions ship no VERSION_ID, so BUILD_ID answers for them.
      version: declared.get("VERSION_ID") ?? declared.get("BUILD_ID") ?? reported.release,
      codename: declared.get("VERSION_CODENAME") ?? named(reported.codename),
      kernel: reported.kernel,
      display: { pretty },
    };
  }

  /**
   * Space, per filesystem and in total.
   *
   * The totals are the root filesystem's, because that is what "how much space
   * does this machine have" means to anyone asking before they install
   * something. Every mounted filesystem is listed beside them, keyed by its
   * mount point, so a caller that cares about a particular directory can find
   * the filesystem holding it.
   */
  private storage(filesystems: si.Systeminformation.FsSizeData[]): FactData["storage"] {
    const root = filesystems.find((filesystem) => filesystem.mount === "/") ?? filesystems[0];

    return {
      totalBytes: root?.size ?? 0,
      availableBytes: root?.available ?? 0,
      filesystems: Object.fromEntries(filesystems.map((filesystem) => [filesystem.mount, {
        status: "present",
        mount: filesystem.mount,
        device: filesystem.fs,
        type: filesystem.type,
        totalBytes: filesystem.size,
        availableBytes: filesystem.available,
        usedBytes: filesystem.used,
        readOnly: !filesystem.rw,
      }])),
      mounts: Object.fromEntries(filesystems.map((filesystem) => [filesystem.mount, {
        path: filesystem.mount,
        totalBytes: filesystem.size,
        availableBytes: filesystem.available,
      }])),
    };
  }

  /**
   * Whether this machine can run a virtual machine.
   *
   * Not whether it is one. A blueprint asks the first question, because that is
   * what decides if a target can be created here at all.
   */
  private virtualization(): FactData["virtualization"] {
    if (this.platform.is("macos")) {
      return { supported: true, enabled: true, type: "hvf" };
    }

    if (this.platform.is("linux")) {
      const kvm = existsSync("/dev/kvm");

      return {
        supported: kvm,
        enabled: kvm,
        type: "kvm",
        reason: kvm ? undefined : "dev_kvm_absent",
      };
    }

    return { supported: false, reason: "platform_not_supported" };
  }

  private network(
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

  /**
   * Which package managers this machine has, keyed by manager name.
   *
   * A manager is present when its driving executable resolves on PATH — that is
   * what "this machine has apt" means to anyone about to install something.
   */
  private async packageManagers(): Promise<FactData["packages"]["managers"]> {
    const found = await Promise.all(packageManagers.map(async (manager) => {
      const path = await which(manager.executable, { nothrow: true });

      return path === null ? undefined : [manager.name, { status: "present" as const, path }] as const;
    }));

    return Object.fromEntries(found.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined));
  }

  /**
   * What this account is allowed to do.
   *
   * Being root is read from the account itself. Passwordless `sudo` is the one
   * thing here that is probed rather than read: no API reports it, because the
   * only evidence that sudo runs without a password is sudo having run without
   * one. A cached credential from an earlier prompt can therefore make this read
   * `present` on a machine that would normally ask.
   */
  private privileges(): FactData["privileges"] {
    const root = userInfo().uid === 0;

    if (root) {
      return {
        mode: "root",
        admin: { status: "present" },
        sudo: { status: "present", passwordless: true, reason: "running_as_root" },
      };
    }

    const passwordless = this.sudoRunsWithoutPassword();

    return {
      mode: "sudo",
      admin: { status: "absent" },
      sudo: {
        status: passwordless ? "present" : "absent",
        passwordless,
      },
    };
  }

  private sudoRunsWithoutPassword(): boolean {
    try {
      execFileSync("sudo", ["-n", "true"], { stdio: "ignore", timeout: 5000 });

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * What the distribution says it is.
 *
 * `/etc/os-release` is a shell fragment of `KEY=value` lines, quoted where the
 * value has spaces in it. It is read rather than sourced, because sourcing a file
 * runs it, and reading a fact must not run anything.
 */
function osRelease(): Map<string, string> {
  const declared = new Map<string, string>();
  let content: string;

  try {
    content = readFileSync("/etc/os-release", "utf8");
  } catch {
    return declared;
  }

  for (const line of content.split("\n")) {
    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    if (value !== "") {
      declared.set(line.slice(0, separator).trim(), value);
    }
  }

  return declared;
}

/**
 * A name a tool actually reported, or nothing.
 *
 * Placeholders travel: `si` answers `-` for a cpu model a virtual machine does
 * not expose, and a snapshot saying the model is `-` is worse than one saying
 * nothing, because it reads like an answer.
 */
function named(reported: string | undefined): string | undefined {
  const value = (reported ?? "").trim();

  return value === "" || value === "-" ? undefined : value;
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
