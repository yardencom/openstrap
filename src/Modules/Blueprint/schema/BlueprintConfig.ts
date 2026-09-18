import type { FileAccess, StepValue } from "#types/Action.js";
import type { Guard } from "#types/Step.js";
import type { DeclaredService, Registry } from "#types/Services.js";
import type { TargetlessRequirement } from "../../Requirements/index.js";

/** A step in the words it is written in. */
export type WrittenStep = {
  id: string;
  /** The requirements this step makes true. Only where it is written apart from them. */
  for?: string[];
  guard?: Guard;

  /** One shell line — what a pipe or a redirect needs. */
  run?: string;
  /** A program and its arguments, with no shell to reinterpret them. */
  exec?: string[];
  write?: { path: string; content: string; access?: FileAccess };
  remove?: { path: string; recursive?: boolean };
  download?: { url: string; path: string; access?: FileAccess };

  cwd?: string;
  environment?: Record<string, StepValue>;
  timeoutMs?: number;
};

/** A requirement as written, which may carry the steps that answer it. */
export type WrittenRequirement = TargetlessRequirement & { steps?: WrittenStep[] };

/** The blueprint as written by a developer. */
export type BlueprintTargetConfig = {
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
  display?: boolean;
  services?: Record<string, DeclaredService>;
  registries?: Record<string, Registry>;
  requirements?: WrittenRequirement[];
  /** Steps that are not about any one requirement. The exception, not the rule. */
  steps?: WrittenStep[];
};

export type BlueprintConfig = {
  targets: Record<string, BlueprintTargetConfig>;
};
