import type { Asked } from "#types/FactDeclaration.js";
import si from "systeminformation";

import type { FactSections } from "#types/Facts.js";

/** What this machine stores things on. */
export class StorageFacts {
  async storage(declared: Asked | undefined): Promise<FactSections["storage"]> {
    if (declared === undefined) {
      return undefined;
    }

    return this.filesystems(await si.fsSize());
  }

/** Space, per filesystem and in total. */
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
