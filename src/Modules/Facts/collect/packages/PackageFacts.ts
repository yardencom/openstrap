import type { PackageDeclaration } from "../../domain/FactDeclaration.js";
import type { PackageFact } from "../../domain/FactModel.js";

/** What openstrap can honestly say about packages a caller declared. */
export class PackageFacts {
  /**
   * Installed packages, which no API reports portably.
   *
   * Every package manager answers a different question in a different format,
   * and none of them has an interface that is not its own command line. Saying
   * so is the honest answer: a caller that declared a package learns that
   * openstrap did not look, rather than that the package is missing.
   */
  packages(declared: Record<string, PackageDeclaration>): Record<string, PackageFact> {
    return Object.fromEntries(
      Object.entries(declared).flatMap(([id, declaration]) => declaration.names.map((name) => [
        declaration.names.length === 1 ? id : `${id}.${name}`,
        {
          status: "unsupported" as const,
          name,
          manager: declaration.manager,
          reason: "installed_packages_not_read",
        },
      ] as const)),
    );
  }
}
