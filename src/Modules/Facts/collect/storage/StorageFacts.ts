import si from "systeminformation";

import type { FactSections } from "../../types/FactModel.js";

/** What this machine stores things on. */
export class StorageFacts {
  async storage(declared: Record<string, never> | undefined): Promise<FactSections["storage"]> {
    if (declared === undefined) {
      return undefined;
    }

    return this.filesystems(await si.fsSize());
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
  private filesystems(filesystems: si.Systeminformation.FsSizeData[]): FactSections["storage"] {
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
}
