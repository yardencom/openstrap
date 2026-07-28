import { userInfo } from "node:os";

import { describe, expect, it } from "vitest";

import { AccountFacts } from "./AccountFacts.js";
import { Platform } from "./Platform.js";

const facts = new AccountFacts(Platform.current());
const account = userInfo();
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";

describe("the account doing the reading", () => {
  it("is answered in full on every platform, whatever the files hold", () => {
    const answered = facts.accounts({})[account.username]!;

    expect(answered).toMatchObject({
      status: "present",
      name: account.username,
      uid: account.uid,
      gid: account.gid,
      home: account.homedir,
    });
  });

  it("carries the groups the kernel actually grants, not only the ones a file lists", () => {
    const groups = facts.accounts({})[account.username]!.groups ?? [];

    // On macOS `/etc/group` lists only `root` in `admin`, so a file-only answer
    // would be shorter than what the process was actually granted.
    expect(groups.length).toBeGreaterThanOrEqual(process.getgroups!().length);
    expect(groups).not.toContain("");
  });

  it("answers a declared user that is this account from the account itself", () => {
    const answered = facts.accounts({ me: { name: account.username } });

    expect(answered.me).toMatchObject({ status: "present", name: account.username, uid: account.uid });
    expect(answered.me!.groups).toEqual(facts.accounts({})[account.username]!.groups);
  });
});

describe("declared users", () => {
  it("reads a system account out of the passwd database", () => {
    const answered = facts.accounts({ superuser: { name: "root" } });

    expect(answered.superuser).toMatchObject({ status: "present", name: "root", uid: 0 });
    expect(answered.superuser!.home).not.toBe("");
  });

  it("reports an asserted uid that does not match as an error, not another user", () => {
    const answered = facts.accounts({ superuser: { name: "root", uid: 1234 } });

    expect(answered.superuser).toMatchObject({
      status: "error",
      name: "root",
      uid: 0,
      reason: "user_uid_does_not_match",
    });
  });

  it("accepts an asserted uid that matches", () => {
    expect(facts.accounts({ superuser: { name: "root", uid: 0 } }).superuser!.status).toBe("present");
  });

  it("takes the key as the name when the caller gives no other", () => {
    expect(facts.accounts({ root: {} }).root).toMatchObject({ status: "present", uid: 0 });
  });

  it("does not look for a user declared for another platform", () => {
    expect(facts.accounts({ elsewhere: { name: "root", platforms: [otherPlatform] } }).elsewhere)
      .toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });

  it("reads nobody who was not named, apart from the account doing the reading", () => {
    expect(Object.keys(facts.accounts({}))).toEqual([account.username]);
  });
});

describe("declared groups", () => {
  it("reads a system group and who is in it", () => {
    const wanted = Platform.current().is("macos") ? "wheel" : "root";
    const answered = facts.members({ superusers: { name: wanted } });

    expect(answered.superusers).toMatchObject({ status: "present", name: wanted, gid: 0 });
    expect(answered.superusers!.members).toContain("root");
  });

  it("reports an asserted gid that does not match as an error", () => {
    const wanted = Platform.current().is("macos") ? "wheel" : "root";

    expect(facts.members({ superusers: { name: wanted, gid: 999 } }).superusers).toMatchObject({
      status: "error",
      gid: 0,
      reason: "group_gid_does_not_match",
    });
  });

  it("does not look for a group declared for another platform", () => {
    expect(facts.members({ elsewhere: { name: "wheel", platforms: [otherPlatform] } }).elsewhere)
      .toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });
});

/**
 * The claim a platform's account file is entitled to make.
 *
 * This is the whole reason users are not simply "in the file or absent". On Linux
 * `/etc/passwd` is the local account database, so a miss is an answer. On macOS
 * local accounts live in a directory service the file does not cover — it holds
 * system accounts only, and `/var/db/dslocal` needs root — so a miss means nobody
 * looked, and reporting `absent` there would be a wrong fact rather than a
 * missing one.
 */
describe("what a miss means", () => {
  it("is absent on linux, where the file is the local account database", () => {
    const linux = new AccountFacts(Platform.of("linux"));

    expect(linux.accounts({ ghost: { name: "openstrap-no-such-user" } }).ghost).toMatchObject({
      status: "absent",
      name: "openstrap-no-such-user",
    });
    expect(linux.members({ ghost: { name: "openstrap-no-such-group" } }).ghost).toMatchObject({ status: "absent" });
  });

  it("is unknown on macos, where local accounts are not in the file", () => {
    const macos = new AccountFacts(Platform.of("macos"));

    expect(macos.accounts({ ghost: { name: "openstrap-no-such-user" } }).ghost).toMatchObject({
      status: "unknown",
      reason: "local_user_database_not_readable",
    });
    expect(macos.members({ ghost: { name: "openstrap-no-such-group" } }).ghost).toMatchObject({
      status: "unknown",
      reason: "local_group_database_not_readable",
    });
  });

  it("says a macos group's membership may be short, because the file is not the whole list", () => {
    const macos = new AccountFacts(Platform.of("macos"));
    const linux = new AccountFacts(Platform.of("linux"));
    // A group the file certainly holds on whatever machine this runs on: the
    // primary group of the account running the test.
    const own = { primary: { gid: userInfo().gid } };

    expect(macos.members(own).primary).toMatchObject({ status: "present", reason: "members_may_be_incomplete" });
    expect(linux.members(own).primary).toMatchObject({ status: "present" });
    expect(linux.members(own).primary?.reason).toBeUndefined();
  });
});
