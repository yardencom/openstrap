import { existsSync, readFileSync } from "node:fs";

import type { FactSections } from "../../types/FactModel.js";
import type { Platform } from "../platform/Platform.js";

/** Whether this machine is itself a guest, and of what. */
export class VirtualizationFacts {
  constructor(private readonly platform: Platform) {}

  virtualization(declared: Record<string, never> | undefined): FactSections["virtualization"] {
    if (declared === undefined) {
      return undefined;
    }

    return this.reported();
  }

/**
   * Whether this machine can run a virtual machine.
   *
   * Not whether it is one. A blueprint asks the first question, because that is
   * what decides if a target can be created here at all.
   */
  private reported(): FactSections["virtualization"] {
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
}
