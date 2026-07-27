import { parseAssignments } from "../Inventory.js";
import { UnsupportedOperatingSystemError, type OperatingSystem } from "../OperatingSystem.js";
import type { Shell } from "../Shell.js";

export type OperatingSystemFact = {
  family: string;
  name: string;
  version: string;
  kernel: string;
  pretty: string;
};

export type CpuFact = {
  cores: number;
  threads: number;
  model: string;
};

export type CapacityFact = {
  totalBytes: number;
  availableBytes: number;
};

export type NetworkFact = {
  hostname: string;
};

export type UsersFact = {
  current: {
    name: string;
    home: string;
    uid: number;
  };
};

export type PackagesFact = {
  managers: Record<string, { status: "present" }>;
};

export type PrivilegesFact = {
  mode: "root" | "sudo";
  admin: { status: "present" | "absent" };
  sudo: { status: "present" | "absent"; passwordless: boolean };
};

/** The scalar sections of a snapshot: one value each, not a map of named things. */
export type SystemReading = {
  os: OperatingSystemFact;
  arch: string;
  cpu: CpuFact;
  memory: CapacityFact;
  storage: CapacityFact;
  network: NetworkFact;
  users: UsersFact;
  packages: PackagesFact;
  privileges: PrivilegesFact;
};

export class SystemReadingsError extends Error {
  constructor(missing: readonly string[]) {
    super(`The target answered without these readings: ${missing.join(", ")}`);
    this.name = "SystemReadingsError";
  }
}

type Reading = {
  readonly key: string;
  readonly command: string;
};

type PackageManager = {
  readonly name: string;
  readonly executable: string;
};

type Variant = {
  readonly readings: readonly Reading[];
  readonly packageManagers: readonly PackageManager[];
};

/**
 * The readings a target answers with one value each.
 *
 * Unlike the inventories this is not keyed by name — nobody asks "is `cpu`
 * present". It produces the sections a requirement compares against: how much
 * memory there is, which architecture this is, who is running.
 *
 * Every reading is taken in a single round trip. A connection has a limited
 * number of channels, and a reading that failed because no channel was left is
 * indistinguishable from a machine that genuinely has no answer.
 */
export class SystemReadings {
  /**
   * Questions whose command is the same everywhere.
   *
   * Only what genuinely differs is written twice. A reading that is spelled
   * once cannot drift between operating systems.
   */
  private static readonly COMMON: readonly Reading[] = [
    { key: "kernel", command: "uname -r" },
    { key: "arch", command: "uname -m" },
    { key: "hostname", command: "hostname || uname -n" },
    { key: "user", command: "id -un" },
    { key: "uid", command: "id -u" },
    { key: "home", command: 'printf %s "${HOME:-$(cd ~ && pwd)}"' },
    { key: "admin", command: '[ "$(id -u)" -eq 0 ] && echo yes || echo no' },
    { key: "sudo", command: "sudo -n true && echo yes || echo no" },
  ];

  /**
   * `df -Pk` rather than the shorter spellings: POSIX output never wraps a long
   * device name onto a second line, and 1024-byte blocks are the one unit both
   * BSD and GNU `df` agree on. `-B1` would be plainer but busybox has no `-B`.
   *
   * Byte counts are printed with `%.0f`, never `%d`. busybox `awk` casts to a
   * 32-bit int for `%d`, so a 6 GB machine reads back as exactly 2147483647 —
   * a wrong fact rather than a missing one, which is the worse of the two.
   */
  private static readonly DARWIN: Variant = {
    readings: [
      { key: "os_name", command: "echo macos" },
      // The product version, not `uname -r`: macOS 26 runs kernel 25, and a
      // requirement written against "26" must not be answered with "25".
      { key: "os_version", command: "sw_vers -productVersion" },
      { key: "os_pretty", command: `printf '%s %s' "$(sw_vers -productName)" "$(sw_vers -productVersion)"` },
      { key: "cpu_cores", command: "sysctl -n hw.ncpu" },
      { key: "cpu_model", command: "sysctl -n machdep.cpu.brand_string" },
      { key: "mem_total", command: "sysctl -n hw.memsize" },
      // Free pages alone read as a few megabytes on a healthy Mac, because the
      // kernel keeps what it can. Inactive and speculative pages are handed
      // back on demand, which is what Linux calls MemAvailable — counting them
      // is what makes "2 GB available" mean the same thing on both.
      {
        key: "mem_available",
        command: [
          "vm_stat | awk '",
          '/page size of/ {gsub(/[^0-9]/, "", $8); size = $8}',
          '/^Pages free/ {gsub(/[^0-9]/, "", $3); free = $3}',
          '/^Pages inactive/ {gsub(/[^0-9]/, "", $3); inactive = $3}',
          '/^Pages speculative/ {gsub(/[^0-9]/, "", $3); speculative = $3}',
          'END {printf "%.0f", (free + inactive + speculative) * size}',
          "'",
        ].join(" "),
      },
      { key: "disk_total", command: `df -Pk / | awk 'NR == 2 {printf "%.0f", $2 * 1024}'` },
      { key: "disk_available", command: `df -Pk / | awk 'NR == 2 {printf "%.0f", $4 * 1024}'` },
    ],
    packageManagers: [
      { name: "brew", executable: "brew" },
      { name: "port", executable: "port" },
    ],
  };

  private static readonly LINUX: Variant = {
    readings: [
      { key: "os_name", command: '. /etc/os-release; printf %s "$ID"' },
      // Rolling distributions ship no VERSION_ID, so BUILD_ID answers for them.
      { key: "os_version", command: '. /etc/os-release; printf %s "${VERSION_ID:-$BUILD_ID}"' },
      { key: "os_pretty", command: '. /etc/os-release; printf %s "${PRETTY_NAME:-$NAME $VERSION_ID}"' },
      { key: "cpu_cores", command: "nproc" },
      // `model name` is an x86 spelling; arm64 kernels write none of it, so the
      // machine name answers instead. `awk` exits 0 on no match, hence the
      // explicit `exit 1` — otherwise the fallback would never run.
      {
        key: "cpu_model",
        command: [
          "awk -F': *' '",
          "/^(model name|Model|Hardware|cpu model)/ {print $2; found = 1; exit}",
          "END {if (!found) exit 1}",
          "' /proc/cpuinfo || uname -m",
        ].join(" "),
      },
      { key: "mem_total", command: `awk '/^MemTotal:/ {printf "%.0f", $2 * 1024}' /proc/meminfo` },
      // MemAvailable arrived in Linux 3.14; older kernels only count MemFree.
      {
        key: "mem_available",
        command: [
          "awk '",
          '/^MemAvailable:/ {printf "%.0f", $2 * 1024; found = 1; exit}',
          "END {if (!found) exit 1}",
          "' /proc/meminfo",
          `|| awk '/^MemFree:/ {printf "%.0f", $2 * 1024}' /proc/meminfo`,
        ].join(" "),
      },
      { key: "disk_total", command: `df -Pk / | awk 'NR == 2 {printf "%.0f", $2 * 1024}'` },
      { key: "disk_available", command: `df -Pk / | awk 'NR == 2 {printf "%.0f", $4 * 1024}'` },
    ],
    packageManagers: [
      { name: "apt", executable: "apt-get" },
      { name: "dnf", executable: "dnf" },
      { name: "yum", executable: "yum" },
      { name: "zypper", executable: "zypper" },
      { name: "pacman", executable: "pacman" },
      { name: "apk", executable: "apk" },
      { name: "brew", executable: "brew" },
    ],
  };

  /** Readings that must come back. An empty answer here is a fault, not a fact. */
  private static readonly REQUIRED: readonly string[] = [
    "os_name",
    "os_version",
    "os_pretty",
    "kernel",
    "arch",
    "hostname",
    "cpu_cores",
    "cpu_model",
    "mem_total",
    "mem_available",
    "disk_total",
    "disk_available",
    "user",
    "uid",
    "home",
  ];

  async read(shell: Shell, operatingSystem: OperatingSystem): Promise<SystemReading> {
    const variant = this.variant(operatingSystem);
    const readings = [
      ...variant.readings,
      ...SystemReadings.COMMON,
      ...variant.packageManagers.map((manager) => ({
        key: `package_${manager.name}`,
        command: `command -v ${manager.executable} >/dev/null && echo yes || echo no`,
      })),
    ];
    const values = parseAssignments(await shell.run(this.script(readings)));

    this.verify(values);

    const admin = this.flag(values, "admin");
    const sudo = this.flag(values, "sudo");

    return {
      os: {
        family: operatingSystem.family,
        name: this.text(values, "os_name"),
        version: this.text(values, "os_version"),
        kernel: this.text(values, "kernel"),
        pretty: this.text(values, "os_pretty"),
      },
      arch: this.architecture(this.text(values, "arch")),
      cpu: {
        // Both `nproc` and `hw.ncpu` count what the scheduler can run on, so
        // cores and threads are the same number until something asks for the
        // package layout, which neither answers without a second tool.
        cores: this.count(values, "cpu_cores"),
        threads: this.count(values, "cpu_cores"),
        model: this.text(values, "cpu_model"),
      },
      memory: {
        totalBytes: this.count(values, "mem_total"),
        availableBytes: this.amount(values, "mem_available"),
      },
      storage: {
        totalBytes: this.count(values, "disk_total"),
        availableBytes: this.amount(values, "disk_available"),
      },
      network: { hostname: this.text(values, "hostname") },
      users: {
        current: {
          name: this.text(values, "user"),
          home: this.text(values, "home"),
          uid: this.amount(values, "uid"),
        },
      },
      packages: { managers: this.managers(values, variant.packageManagers) },
      privileges: {
        mode: admin ? "root" : "sudo",
        admin: { status: admin ? "present" : "absent" },
        sudo: {
          status: sudo ? "present" : "absent",
          passwordless: sudo,
        },
      },
    };
  }

  private variant(operatingSystem: OperatingSystem): Variant {
    const variant = operatingSystem.select<Variant | null>({
      linux: SystemReadings.LINUX,
      darwin: SystemReadings.DARWIN,
      windows: null,
    });

    if (!variant) {
      throw new UnsupportedOperatingSystemError(operatingSystem.name);
    }

    return variant;
  }

  /**
   * One script, one round trip.
   *
   * Each reading prints `key=value` and swallows its own noise, so a tool that
   * is not installed leaves an empty value rather than derailing the rest. The
   * reading is wrapped in a group before stderr is discarded — otherwise the
   * redirection would only cover the last command of a fallback chain.
   */
  private script(readings: readonly Reading[]): string {
    return readings
      .map((reading) => `printf '%s=%s\\n' ${reading.key} "$({ ${reading.command}; } 2>/dev/null)"`)
      .join("\n");
  }

  private verify(values: Map<string, string>): void {
    const missing = SystemReadings.REQUIRED.filter((key) => !values.get(key));

    if (missing.length > 0) {
      throw new SystemReadingsError(missing);
    }
  }

  private text(values: Map<string, string>, key: string): string {
    return values.get(key) ?? "";
  }

  /** A count that has to be there: zero cores or zero bytes of RAM is a failed read. */
  private count(values: Map<string, string>, key: string): number {
    const value = this.amount(values, key);

    if (value === 0) {
      throw new SystemReadingsError([key]);
    }

    return value;
  }

  /** A quantity that may legitimately be zero — free space, or root's uid. */
  private amount(values: Map<string, string>, key: string): number {
    const value = Number(this.text(values, key));

    if (!Number.isInteger(value) || value < 0) {
      throw new SystemReadingsError([key]);
    }

    return value;
  }

  private flag(values: Map<string, string>, key: string): boolean {
    return this.text(values, key) === "yes";
  }

  /** Keyed by manager name, because a requirement asks for `apt`, not for the third entry. */
  private managers(
    values: Map<string, string>,
    candidates: readonly PackageManager[],
  ): Record<string, { status: "present" }> {
    return Object.fromEntries(
      candidates
        .filter((manager) => this.flag(values, `package_${manager.name}`))
        .map((manager) => [manager.name, { status: "present" as const }]),
    );
  }

  private architecture(reported: string): string {
    const names: Record<string, string> = {
      aarch64: "arm64",
      arm64: "arm64",
      amd64: "x64",
      x86_64: "x64",
    };

    return names[reported] ?? reported;
  }
}
