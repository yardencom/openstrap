import { describe, expect, it } from "vitest";

import { ServiceFacts } from "./ServiceFacts.js";
import { Platform } from "../platform/Platform.js";

const facts = new ServiceFacts(Platform.current());
const otherPlatform = Platform.current().is("linux") ? "macos" : "linux";

describe("services", () => {
  it("asks nothing when nothing was declared, because no requirement asks for a list", async () => {
    expect(await facts.services({})).toEqual({});
  });

  it("reports a service that is not running as absent, whatever is installed", async () => {
    const answered = await facts.services({ ghost: { name: "openstrap-no-such-service" } });

    expect(answered.ghost).toMatchObject({
      status: "absent",
      name: "openstrap-no-such-service",
      running: false,
      pids: [],
    });
  });

  it("finds a running service and says which processes are serving it", async () => {
    // launchd is pid 1 on macOS and systemd is pid 1 on Linux, so one of the two
    // is running wherever this test runs.
    const answered = await facts.services({ init: { name: Platform.current().is("macos") ? "launchd" : "systemd" } });

    expect(answered.init).toMatchObject({ status: "present", running: true, state: "running" });
    expect(answered.init!.pids).toContain(1);
  });

  it("names the manager that answered for the service", async () => {
    const answered = await facts.services({ ghost: { name: "openstrap-no-such-service" } });

    expect(answered.ghost!.manager).toBe(Platform.current().is("macos") ? "launchd" : "systemd");
  });

  /**
   * Whether the service will be there after a reboot.
   *
   * A different question from whether it is running now, and the reason this is read at all:
   * `services.k3s.enabled` was in a blueprint, the machine had it enabled, and openstrap answered
   * "cannot be verified" — because it only ever asked systeminformation, whose `startmode` is a
   * hardcoded empty string outside Windows.
   */
  describe("starting at boot", () => {
    it("is a yes or a no where a service manager can be asked, and nothing where it cannot", async () => {
      const answered = await facts.services({ init: { name: Platform.current().is("macos") ? "launchd" : "systemd" } });

      // systemd answers in an exit status. launchd has no equivalent single question, so the field
      // is left off — which a requirement reports as unverifiable rather than as "not enabled".
      expect(typeof answered.init!.enabled).toBe(Platform.current().is("macos") ? "undefined" : "boolean");
    });

    it("is not invented for a service that is not there", async () => {
      const answered = await facts.services({ ghost: { name: "openstrap-no-such-service" } });

      // Where the manager can be asked it says no; where it cannot, nothing is said. What must never
      // happen is a `true` nobody was told, or a `false` that means "openstrap could not look".
      expect(answered.ghost!.enabled).toBe(Platform.current().is("macos") ? undefined : false);
    });

    it("asks nothing of a manager the blueprint named itself", async () => {
      const answered = await facts.services({ odd: { name: "whatever", manager: "runit" } });

      expect(answered.odd!.manager).toBe("runit");
      expect(answered.odd!.enabled).toBeUndefined();
    });
  });

  it("does not ask about a service declared for another platform", async () => {
    const answered = await facts.services({ elsewhere: { name: "sshd", platforms: [otherPlatform] } });

    expect(answered.elsewhere).toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });
});
