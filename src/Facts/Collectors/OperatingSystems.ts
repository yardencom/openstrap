import type { Probe } from "./Probe.js";

export type OperatingSystemName = "linux" | "darwin";

/**
 * What each operating system is asked, for the same set of facts.
 *
 * The keys are identical everywhere. Only the command differs, which is the
 * whole of the variation between a Mac and a Linux guest — and none of it is
 * variation by how the machine is reached.
 */
export const probesByOperatingSystem: Record<OperatingSystemName, readonly Probe[]> = {
  linux: [
    { key: "os_name", command: ". /etc/os-release; printf %s \"$ID\"" },
    { key: "os_version", command: ". /etc/os-release; printf %s \"$VERSION_ID\"" },
    { key: "os_pretty", command: ". /etc/os-release; printf %s \"$PRETTY_NAME\"" },
    { key: "kernel", command: "uname -r" },
    { key: "arch", command: "uname -m" },
    { key: "hostname", command: "hostname" },
    { key: "cpu_cores", command: "nproc" },
    { key: "cpu_model", command: "awk -F: '/model name/ {print $2; exit}' /proc/cpuinfo || uname -p" },
    { key: "mem_total", command: "awk '/MemTotal/ {print $2 * 1024}' /proc/meminfo" },
    { key: "mem_available", command: "awk '/MemAvailable/ {print $2 * 1024}' /proc/meminfo" },
    { key: "disk_total", command: "df -B1 / | awk 'NR==2 {print $2}'" },
    { key: "disk_available", command: "df -B1 / | awk 'NR==2 {print $4}'" },
    { key: "user", command: "id -un" },
    { key: "home", command: "printf %s \"$HOME\"" },
    { key: "admin", command: "[ \"$(id -u)\" -eq 0 ] && echo yes || echo no" },
    { key: "sudo", command: "sudo -n true && echo yes || echo no" },
    { key: "sshd", command: "systemctl is-active --quiet ssh || systemctl is-active --quiet sshd && echo yes || echo no" },
    { key: "process_count", command: "ps -e --no-headers | wc -l" },
    { key: "service_count", command: "systemctl list-units --type=service --all --no-legend --no-pager | wc -l" },
    { key: "package_manager", command: "command -v apt-get >/dev/null && echo apt || command -v dnf >/dev/null && echo dnf || echo unknown" },
  ],
  darwin: [
    { key: "os_name", command: "echo macos" },
    { key: "os_version", command: "sw_vers -productVersion" },
    { key: "os_pretty", command: "printf '%s %s' \"$(sw_vers -productName)\" \"$(sw_vers -productVersion)\"" },
    { key: "kernel", command: "uname -r" },
    { key: "arch", command: "uname -m" },
    { key: "hostname", command: "hostname" },
    { key: "cpu_cores", command: "sysctl -n hw.ncpu" },
    { key: "cpu_model", command: "sysctl -n machdep.cpu.brand_string" },
    { key: "mem_total", command: "sysctl -n hw.memsize" },
    { key: "mem_available", command: "vm_stat | awk '/Pages free/ {gsub(/\\./,\"\",$3); print $3 * 16384}'" },
    { key: "disk_total", command: "df -k / | awk 'NR==2 {print $2 * 1024}'" },
    { key: "disk_available", command: "df -k / | awk 'NR==2 {print $4 * 1024}'" },
    { key: "user", command: "id -un" },
    { key: "home", command: "printf %s \"$HOME\"" },
    { key: "admin", command: "[ \"$(id -u)\" -eq 0 ] && echo yes || echo no" },
    { key: "sudo", command: "sudo -n true && echo yes || echo no" },
    { key: "sshd", command: "launchctl print system/com.openssh.sshd >/dev/null && echo yes || echo no" },
    { key: "process_count", command: "ps -e | tail -n +2 | wc -l" },
    { key: "service_count", command: "launchctl list | tail -n +2 | wc -l" },
    { key: "package_manager", command: "command -v brew >/dev/null && echo brew || echo unknown" },
  ],
};

/** Tools asked about the same way everywhere, because the question is the same. */
export const toolProbes: readonly Probe[] = [
  { key: "tool_node", command: "node --version" },
  { key: "tool_npm", command: "npm --version" },
  { key: "tool_python3", command: "python3 --version" },
  { key: "tool_git", command: "git --version" },
];
