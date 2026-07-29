import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

import type { FactSections } from "../../domain/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/** What the account this is running as is allowed to do. */
export class PrivilegeFacts {
  constructor(private readonly platform: Platform) {}

  privileges(declared: Record<string, never> | undefined): FactSections["privileges"] {
    if (declared === undefined) {
      return undefined;
    }

    return this.reported();
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
