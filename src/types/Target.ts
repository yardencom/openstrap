/** Taken from the plugin contract rather than declared again here. */
export type { TargetScope, TargetType } from "@openstrap/plugin-contract";

import type { TargetScope, TargetType } from "@openstrap/plugin-contract";

/** A machine openstrap is talking about. */
export type Target = {
  name: string;
  scope: TargetScope;
  type: TargetType;
  displayName?: string;
};
