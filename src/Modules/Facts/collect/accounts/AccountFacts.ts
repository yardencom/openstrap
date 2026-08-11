import { readFileSync } from "node:fs";
import { userInfo } from "node:os";

import type { GroupDeclaration, UserDeclaration } from "#types/FactDeclaration.js";
import type { FactSections, GroupFact, UserFact } from "#types/Facts.js";
import type { Platform } from "../platform/Platform.js";

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

/** Who exists on the machine, and which groups they are in. */
export class AccountFacts {
  private readonly users = AccountFacts.readPasswd();
  private readonly groups = AccountFacts.readGroups();

  constructor(private readonly platform: Platform) {}

  /**
   * An answer for every user the caller named, and for the account doing the reading whether it was named or
   * not.
   */
  accounts(declared: Record<string, UserDeclaration> | undefined): FactSections["users"] {
    if (declared === undefined) {
      return {};
    }

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

  members(declared: Record<string, GroupDeclaration> | undefined): Record<string, GroupFact> {
    if (declared === undefined) {
      return {};
    }

    return Object.fromEntries(Object.entries(declared).map(([id, declaration]) => {
      if (!this.platform.matches(declaration.platforms)) {
        return [id, { status: "unsupported" as const, name: declaration.name ?? id, reason: "platform_not_selected" }];
      }

      return [id, this.group(id, declaration)];
    }));
  }

  /** The account this reading runs as. */
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

  /** Every group this process belongs to, by name. */
  private currentGroupNames(primaryGid: number): string[] {
    const granted = typeof process.getgroups === "function" ? process.getgroups() : [primaryGid];
    const byGid = new Map([...this.groups.values()].map((group) => [group.gid, group.name]));

    return [...new Set([primaryGid, ...granted])]
      .map((gid) => byGid.get(gid) ?? String(gid))
      .sort();
  }

  /** The account a declaration is about. */
  private user(id: string, declaration: UserDeclaration): UserFact {
    const current = userInfo();
    const wantedUid = AccountFacts.numberOrUndefined(declaration.uid);
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
    const wantedGid = AccountFacts.numberOrUndefined(declaration.gid);
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

  /** Whether what was found is what was asked for. */
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

  /** Everyone the group file lists, plus this account when the kernel says so. */
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

  /** A name the file does not hold. */
  private missing(name: string, kind: "user" | "group"): UserFact & GroupFact {
    return this.localDatabaseIsComplete()
      ? { status: "absent", name }
      : { status: "unknown", name, reason: `local_${kind}_database_not_readable` };
  }

  private localDatabaseIsComplete(): boolean {
    return this.platform.select({ linux: true, macos: false, windows: false });
  }

  /** `/etc/passwd`: `name:password:uid:gid:gecos:home:shell`, one account per line. */
  private static readPasswd(): Map<string, PasswdEntry> {
    const entries = new Map<string, PasswdEntry>();

    for (const fields of AccountFacts.readColonSeparated(passwdFile, 7)) {
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

  private static readGroups(): Map<string, GroupEntry> {
    const entries = new Map<string, GroupEntry>();

    for (const fields of AccountFacts.readColonSeparated(groupFile, 4)) {
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

  private static numberOrUndefined(value: number | string | undefined): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : undefined;
  }

  private static readColonSeparated(path: string, fields: number): string[][] {
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
}


/** `/etc/group`: `name:password:gid:member,member`. */

/** A declared id, which the file format allows as a number or as its text. */
