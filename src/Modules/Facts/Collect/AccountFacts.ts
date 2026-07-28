import { readFileSync } from "node:fs";
import { userInfo } from "node:os";

import type { GroupDeclaration, UserDeclaration } from "../Domain/FactDeclaration.js";
import type { FactData, GroupFact, UserFact } from "../Domain/FactModel.js";
import type { Platform } from "./Platform.js";

const passwdFile = "/etc/passwd";
const groupFile = "/etc/group";

type PasswdEntry = {
  name: string;
  uid: number;
  gid: number;
  gecos?: string;
  home?: string;
  shell?: string;
};

type GroupEntry = {
  name: string;
  gid: number;
  members: string[];
};

/**
 * Who exists on the machine, and which groups they are in.
 *
 * Read from the account databases as files — `/etc/passwd` and `/etc/group` —
 * because those files *are* the interface: they are the format every POSIX system
 * defines its local accounts in, and reading a file asks nothing of the machine.
 * One code path, every platform.
 *
 * What differs is not how the reading works but how complete each platform's file
 * is, and that difference is reported rather than papered over. On Linux the file
 * is the local account database, so a name that is not in it is absent. On macOS
 * local accounts live in a directory service the file does not cover — `/etc/passwd`
 * there holds system accounts only, and `/var/db/dslocal` is unreadable without
 * root — so a name that is not in it is `unknown`, not absent. Claiming absent
 * would be a wrong fact, which is worse than an incomplete one.
 *
 * The account the reading runs as is always answered in full, on every platform,
 * because `node:os` reports it directly and no file is involved.
 */
export class AccountFacts {
  private readonly users = readPasswd();
  private readonly groups = readGroups();

  constructor(private readonly platform: Platform) {}

  /**
   * An answer for every user the caller named, and for the account doing the
   * reading whether it was named or not.
   *
   * The reading account is always there because a snapshot that does not say who
   * read it cannot be compared with the next one: `/home/ada` being writable is a
   * different fact depending on who was asking.
   */
  accounts(declared: Record<string, UserDeclaration>): FactData["users"] {
    const current = this.currentUser();

    return {
      [current.name]: current,
      ...Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
        if (!this.platform.matches(declaration.platforms)) {
          return [id, { status: "unsupported" as const, name: declaration.name ?? id, reason: "platform_not_selected" }];
        }

        return [id, this.user(id, declaration)];
      })),
    };
  }

  members(declared: Record<string, GroupDeclaration>): Record<string, GroupFact> {
    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      if (!this.platform.matches(declaration.platforms)) {
        return [id, { status: "unsupported" as const, name: declaration.name ?? id, reason: "platform_not_selected" }];
      }

      return [id, this.group(id, declaration)];
    }));
  }

  /**
   * The account this reading runs as.
   *
   * `node:os` answers for it directly, so this is the one account that is known in
   * full on every platform whatever the files hold. Its supplementary groups come
   * from the process itself, which is why they are complete on macOS where
   * `/etc/group` is not.
   */
  private currentUser(): UserFact & { status: "present" } {
    const account = userInfo();
    const found = this.users.get(account.username);

    return {
      status: "present",
      name: account.username,
      uid: account.uid,
      gid: account.gid,
      home: account.homedir,
      shell: account.shell ?? undefined,
      gecos: found?.gecos,
      groups: this.currentGroupNames(account.gid),
    };
  }

  /**
   * Every group this process belongs to, by name.
   *
   * `process.getgroups()` reports the group ids the kernel actually grants, which
   * is the only complete answer available: a membership granted by a directory
   * service appears here and in no file.
   */
  private currentGroupNames(primaryGid: number): string[] {
    const granted = typeof process.getgroups === "function" ? process.getgroups() : [primaryGid];
    const byGid = new Map([...this.groups.values()].map((group) => [group.gid, group.name]));

    return [...new Set([primaryGid, ...granted])]
      .map((gid) => byGid.get(gid) ?? String(gid))
      .sort();
  }

  /**
   * The account a declaration is about.
   *
   * Found by whatever identity the caller gave: a name if there is one, otherwise
   * the numeric id, otherwise the key it was declared under. A caller that gives
   * both is asserting they belong together, so a mismatch is an error rather than
   * a different account quietly answering.
   */
  private user(id: string, declaration: UserDeclaration): UserFact {
    const current = userInfo();
    const wantedUid = numberOrUndefined(declaration.uid);
    const wantedName = declaration.name ?? (wantedUid === undefined ? id : undefined);

    if (wantedName === current.username || (wantedName === undefined && wantedUid === current.uid)) {
      return this.matching(this.currentUser(), wantedName, wantedUid, "user");
    }

    const found = wantedName !== undefined
      ? this.users.get(wantedName)
      : [...this.users.values()].find((user) => user.uid === wantedUid);

    if (!found) {
      return this.missing(wantedName ?? String(wantedUid), "user");
    }

    return this.matching({
      status: "present",
      name: found.name,
      uid: found.uid,
      gid: found.gid,
      home: found.home,
      shell: found.shell,
      gecos: found.gecos,
      groups: this.groupNamesOf(found),
    }, wantedName, wantedUid, "user");
  }

  private group(id: string, declaration: GroupDeclaration): GroupFact {
    const wantedGid = numberOrUndefined(declaration.gid);
    const wantedName = declaration.name ?? (wantedGid === undefined ? id : undefined);
    const found = wantedName !== undefined
      ? this.groups.get(wantedName)
      : [...this.groups.values()].find((group) => group.gid === wantedGid);

    if (!found) {
      return this.missing(wantedName ?? String(wantedGid), "group");
    }

    const fact = this.matching({
      status: "present" as const,
      name: found.name,
      gid: found.gid,
      members: this.membersOf(found),
    }, wantedName, wantedGid, "group");

    if (fact.status !== "present") {
      return fact;
    }

    // On a platform whose file is not the whole membership list, saying the list
    // is complete would be the wrong claim. The group is there; who else is in it
    // is not something this file can settle.
    return this.localDatabaseIsComplete() ? fact : { ...fact, reason: "members_may_be_incomplete" };
  }

  /**
   * Whether what was found is what was asked for.
   *
   * A declaration that names both a name and a number claims the two go together.
   * If they do not, the honest answer is that the claim is wrong — not the account
   * that happened to match one half of it.
   */
  private matching<TFact extends { status: "present"; name: string; uid?: number; gid?: number }>(
    fact: TFact,
    wantedName: string | undefined,
    wantedId: number | undefined,
    kind: "user" | "group",
  ): TFact | (Omit<TFact, "status"> & { status: "error"; reason: string }) {
    const foundId = kind === "user" ? fact.uid : fact.gid;
    const nameMatches = wantedName === undefined || wantedName === fact.name;
    const idMatches = wantedId === undefined || wantedId === foundId;

    if (nameMatches && idMatches) {
      return fact;
    }

    return {
      ...fact,
      status: "error",
      reason: idMatches ? `${kind}_name_does_not_match` : `${kind}_${kind === "user" ? "uid" : "gid"}_does_not_match`,
    };
  }

  /**
   * Everyone the group file lists, plus this account when the kernel says so.
   *
   * A user's primary group does not name them as a member — membership by primary
   * gid is implied — so both sources are merged.
   */
  private membersOf(group: GroupEntry): string[] {
    const byPrimaryGid = [...this.users.values()]
      .filter((user) => user.gid === group.gid)
      .map((user) => user.name);
    const current = userInfo();
    const currentIsMember = this.currentGroupNames(current.gid).includes(group.name);

    return [...new Set([
      ...group.members,
      ...byPrimaryGid,
      ...(currentIsMember ? [current.username] : []),
    ])].sort();
  }

  private groupNamesOf(user: PasswdEntry): string[] {
    const primary = [...this.groups.values()].find((group) => group.gid === user.gid);
    const supplementary = [...this.groups.values()]
      .filter((group) => group.members.includes(user.name))
      .map((group) => group.name);

    return [...new Set([...(primary ? [primary.name] : [String(user.gid)]), ...supplementary])].sort();
  }

  /**
   * A name the file does not hold.
   *
   * Whether that means "not on this machine" depends on whether the file is the
   * machine's local account database, which is a property of the platform.
   */
  private missing(name: string, kind: "user" | "group"): UserFact & GroupFact {
    return this.localDatabaseIsComplete()
      ? { status: "absent", name }
      : { status: "unknown", name, reason: `local_${kind}_database_not_readable` };
  }

  private localDatabaseIsComplete(): boolean {
    return this.platform.select({ linux: true, macos: false, windows: false });
  }
}

/**
 * `/etc/passwd`: `name:password:uid:gid:gecos:home:shell`, one account per line.
 *
 * A machine without the file answers with no accounts rather than with a failure:
 * the account the reading runs as is still known, and that is not nothing.
 */
function readPasswd(): Map<string, PasswdEntry> {
  const entries = new Map<string, PasswdEntry>();

  for (const fields of readColonSeparated(passwdFile, 7)) {
    const uid = Number(fields[2]);
    const gid = Number(fields[3]);

    if (!fields[0] || !Number.isInteger(uid) || !Number.isInteger(gid)) {
      continue;
    }

    entries.set(fields[0], {
      name: fields[0],
      uid,
      gid,
      gecos: fields[4] || undefined,
      home: fields[5] || undefined,
      shell: fields[6] || undefined,
    });
  }

  return entries;
}

/** `/etc/group`: `name:password:gid:member,member`. */
function readGroups(): Map<string, GroupEntry> {
  const entries = new Map<string, GroupEntry>();

  for (const fields of readColonSeparated(groupFile, 4)) {
    const gid = Number(fields[2]);

    if (!fields[0] || !Number.isInteger(gid)) {
      continue;
    }

    entries.set(fields[0], {
      name: fields[0],
      gid,
      members: (fields[3] ?? "").split(",").map((member) => member.trim()).filter(Boolean),
    });
  }

  return entries;
}

/** A declared id, which the file format allows as a number or as its text. */
function numberOrUndefined(value: number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : undefined;
}

function readColonSeparated(path: string, fields: number): string[][] {
  let content: string;

  try {
    content = readFileSync(path, "utf8");
  } catch {
    return [];
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split(":"))
    .filter((parts) => parts.length >= fields);
}
