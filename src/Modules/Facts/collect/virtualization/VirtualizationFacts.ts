import type { Asked } from "#types/FactDeclaration.js";
import { existsSync } from "node:fs";

import type { FactSections } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

/** Whether this machine is itself a guest, and of what. */
export class VirtualizationFacts {
  constructor(private readonly platform: Platform) {}

  virtualization(declared: Asked | undefined): FactSections["virtualization"] {
    if (declared === undefined) {
      return undefined;
    }

    return this.reported();
  }

/** Whether this machine can run a virtual machine. */
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
