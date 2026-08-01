import which from "which";

import type { PackageDeclaration } from "#types/FactDeclaration.js";
import type { FactSections, PackageFact } from "#types/Facts.js";

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

/** Which package managers a machine has, and what openstrap can say about the packages declared. */
export class PackageFacts {
  /**
   * Installed packages, which no API reports portably.
   *
   * Every package manager answers a different question in a different format,
   * and none of them has an interface that is not its own command line. Saying
   * so is the honest answer: a caller that declared a package learns that
   * openstrap did not look, rather than that the package is missing.
   */
  async packages(declared: Record<string, PackageDeclaration> | undefined): Promise<FactSections["packages"]> {
    if (declared === undefined) {
      return undefined;
    }

    return { managers: await this.managers(), installed: this.installed(declared) };
  }

  private installed(declared: Record<string, PackageDeclaration>): Record<string, PackageFact> {
    return Object.fromEntries(
      Object.entries(declared).flatMap(([id, declaration]) => (declaration.names ?? [id]).map((name) => [
        (declaration.names ?? [id]).length === 1 ? id : `${id}.${name}`,
        {
          status: "unsupported" as const,
          name,
          manager: declaration.manager,
          reason: "installed_packages_not_read",
        },
      ] as const)),
    );
  }

  /**
   * Which package managers this machine has, keyed by manager name.
   *
   * A manager is present when its driving executable resolves on PATH — that is
   * what "this machine has apt" means to anyone about to install something.
   */
  private async managers(): Promise<NonNullable<FactSections["packages"]>["managers"]> {
    const found = await Promise.all(packageManagers.map(async (manager) => {
      const path = await which(manager.executable, { nothrow: true });

      return path === null ? undefined : [manager.name, { status: "present" as const, path }] as const;
    }));

    return Object.fromEntries(found.filter((entry): entry is NonNullable<typeof entry> => entry !== undefined));
  }
}
