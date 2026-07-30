/**
 * What a machine is, and under which schema of facts it is read.
 *
 * Taken from the plugin contract rather than said again here. A provider declares which scopes and
 * types it can make, so the words are part of what openstrap promises plugin authors; two lists of
 * the same three words could disagree, and one of them would be the one nobody updated. The contract
 * is a package of its own and cannot import openstrap, so the dependency goes this way.
 *
 * `scope` is how the machine is read — `host` is the machine openstrap runs on, `guest` one it
 * reaches through a channel, `network` a thing with an address and no machine to stand on. `type` is
 * what it is, and need not follow: a container is scope `guest` and type `container`.
 */
export type { TargetScope, TargetType } from "@openstrap/plugin-contract";

import type { TargetScope, TargetType } from "@openstrap/plugin-contract";

/**
 * A machine openstrap is talking about.
 *
 * The four fields everything spells: a blueprint declaring one, a snapshot saying which machine it is
 * about, a requirement result naming what it checked, the state store remembering it. They used to be
 * four shapes — `BlueprintTarget`, `FactTarget`, `RequirementTarget`, `TargetRecord` — and only the
 * first typed `scope` and `type`, so the same three words were checked in one place out of four.
 *
 * Nothing here says how the machine is reached. That belongs to whatever opens a channel, and a
 * machine is the same machine however anyone got to it.
 */
export type Target = {
  name: string;
  scope: TargetScope;
  type: TargetType;
  displayName?: string;
};
