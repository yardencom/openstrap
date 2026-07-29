/**
 * What the facts module needs to know about a machine.
 *
 * Deliberately a shape of its own rather than a blueprint target: this module
 * reads a machine and reports what it found, which is worth having with or
 * without openstrap, and it has no idea that blueprints exist.
 *
 * Nothing here says how the machine was reached. Facts are collected the same way
 * everywhere — by openstrap, on the machine — so how anyone got there is no part of
 * naming it. When a channel was opened, whoever opened it records that in the order.
 */
export type FactTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
};
