import { describe, expect, it } from "vitest";
import { LoginCommand } from "../application/LoginCommand.js";
import { LoginText } from "../output/text/LoginText.js";
import { ServerRefusedError } from "../../Api/index.js";
import type { CommandContext } from "../application/CliCommand.js";
import type { OpenStrapRuntime } from "../../Plugin/index.js";

function contextWith(kept: Map<string, string>): CommandContext {
  const store = {
    id: "fake",
    read: async ({ name }: { name: string }) => kept.get(name) ?? null,
    write: async ({ name }: { name: string }, value: string) => void kept.set(name, value),
    remove: async ({ name }: { name: string }) => void kept.delete(name),
  };

  return {
    workspaceRoot: "/nowhere",
    runtime: async () => ({ secretStores: { sole: () => store } }) as unknown as OpenStrapRuntime,
  };
}

const login = { command: "login" as const, forget: false, json: false, local: false, pluginSpecifiers: [] };

describe("Logging in to a server nobody signs people in at", () => {
  it("claims an empty server, and keeps the owner's pass where the blueprint's names point", async () => {
    const kept = new Map<string, string>();
    const claims: string[][] = [];
    const command = new LoginCommand(undefined, () => true, {
      whoSignsIn: async () => undefined,
      issueToken: async () => "never",
      claim: async (organization, name) => {
        claims.push([organization, name]);
        return "ost_first";
      },
    });

    const outcome = await command.execute(login, contextWith(kept));

    expect(kept.get("openstrap.server-token")).toBe("ost_first");
    expect(claims).toHaveLength(1);
    expect(claims[0]![0]).toBe(claims[0]![1]);
    expect(outcome.result).toMatchObject({ kept: true, claimed: true });
    expect(new LoginText().print(outcome.result)).toMatch(/had no owner/);
  });

  it("says how to get a pass when the server already has an owner", async () => {
    const command = new LoginCommand(undefined, () => true, {
      whoSignsIn: async () => undefined,
      issueToken: async () => "never",
      claim: async () => {
        throw new ServerRefusedError(409, "This server already has an owner. Ask them for a token.");
      },
    });

    await expect(command.execute(login, contextWith(new Map()))).rejects.toThrow(/already has an owner.*tokens issue/s);
  });
});
