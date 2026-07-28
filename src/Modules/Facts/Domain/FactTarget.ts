/**
 * What the facts module needs to know about a machine.
 *
 * Deliberately a shape of its own rather than a blueprint target: this module
 * reads a machine and reports what it found, which is worth having with or
 * without openstrap, and it has no idea that blueprints exist.
 */
export type FactTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  /**
   * Which channel reached this machine.
   *
   * Recorded because a snapshot is only comparable to another one taken the
   * same way, and because no reading can work it out for itself: the machine
   * does not know how you got in.
   */
  transport: string;
  /**
   * How the channel authenticated, as the thing that opened it reported.
   *
   * Absent when nobody said, and then the snapshot says nothing about it. A guess
   * here would be a fabricated fact, and requirements are written against this.
   */
  authMethods?: readonly string[];
};
