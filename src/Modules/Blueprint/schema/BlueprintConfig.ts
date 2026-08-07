import type { FileAccess, StepValue } from "#types/Action.js";
import type { Guard } from "#types/Step.js";
import type { TargetlessRequirement } from "../../Requirements/index.js";

/**
 * A step in the words it is written in.
 *
 * Not `Step`. What a person writes and what openstrap carries out are two shapes on purpose: the
 * written one has the action as its key, because that is what reads well in a file; the carried one
 * is a tagged union, because that is what a plan is made of and a plan is printed, stored and sent
 * to another machine. Turning one into the other is the loader's job, and
 * it is the only place the two shapes meet.
 */
export type WrittenStep = {
  id: string;
  /**
   * The requirements this step makes true.
   *
   * Only where a step is written apart from them. Inside a requirement it is that requirement, and
   * saying so again would be a second answer that can disagree with where the step sits.
   */
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

/**
 * The blueprint as written by a developer.
 *
 * It carries only what a person decides: what the target is, where it runs, how big
 * it is, and what has to be true of it. Scope, type, image url, checksum, signature,
 * format and boot mode are derived, never written here.
 *
 * Requirements live inside the target they are about, and the steps that answer a requirement live
 * inside it. Both for the same reason: a thing written where it belongs cannot point at something
 * that is not there, and cannot repeat a name it could not be without.
 */
export type BlueprintTargetConfig = {
  displayName?: string;
  transport?: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements?: WrittenRequirement[];
  /** Steps that are not about any one requirement. The exception, not the rule. */
  steps?: WrittenStep[];
};

export type BlueprintConfig = {
  targets: Record<string, BlueprintTargetConfig>;
};
