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

  it("does not ask about a service declared for another platform", async () => {
    const answered = await facts.services({ elsewhere: { name: "sshd", platforms: [otherPlatform] } });

    expect(answered.elsewhere).toMatchObject({ status: "unsupported", reason: "platform_not_selected" });
  });
});
