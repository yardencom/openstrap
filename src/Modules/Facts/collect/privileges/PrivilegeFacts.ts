import type { Asked } from "#types/FactDeclaration.js";
import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

import type { FactSections } from "#types/Facts.js";

/** What the account this is running as is allowed to do. */
export class PrivilegeFacts {
  privileges(declared: Asked | undefined): FactSections["privileges"] {
    if (declared === undefined) {
      return undefined;
    }

    return this.reported();
  }

/** What this account is allowed to do. */
  private reported(): FactSections["privileges"] {
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
