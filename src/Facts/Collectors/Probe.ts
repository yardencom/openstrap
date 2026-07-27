/**
 * One named reading taken from a target.
 *
 * A collector is a table of these rather than a body of code, so what differs
 * between operating systems is visibly only the command — never the shape of
 * the result, and never which sections exist.
 */
export type Probe = {
  key: string;
  command: string;
};

export type Readings = {
  get(key: string): string;
  number(key: string): number;
  flag(key: string): boolean;
  present(key: string): boolean;
};

export function readings(output: string): Readings {
  const values = new Map<string, string>();

  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");

    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }

  const get = (key: string): string => values.get(key) ?? "";

  return {
    get,
    number: (key) => Number(get(key)) || 0,
    flag: (key) => get(key) === "yes",
    present: (key) => get(key).length > 0,
  };
}

/**
 * Joins probes into a single script.
 *
 * One round trip rather than one per probe: a connection has a limited number
 * of channels, and a probe that fails because the channel could not be opened
 * is indistinguishable from a fact that is genuinely absent.
 */
export function script(probes: readonly Probe[]): string {
  return probes.map((probe) => `printf '%s=%s\\n' ${probe.key} "$(${probe.command} 2>/dev/null)"`).join("; ");
}

export function versionIn(output: string): string | undefined {
  return output.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1];
}
