import { describe, expect, it } from "vitest";
import { SecretArgsParser } from "../arguments/parsers/SecretArgs.js";
import { SecretCommand } from "../application/SecretCommand.js";
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

describe("openstrap secret", () => {
  it("is set or forget, by the name the blueprint uses", () => {
    expect(new SecretArgsParser().parse(["set", "github.packages-read"])).toMatchObject({ did: "set", name: "github.packages-read" });
    expect(new SecretArgsParser().parse(["forget", "x", "--json"])).toMatchObject({ did: "forget", name: "x", json: true });
    expect(() => new SecretArgsParser().parse(["show", "x"])).toThrow(/set\|forget/);
    expect(() => new SecretArgsParser().parse(["set"])).toThrow(/needs the name/);
    expect(() => new SecretArgsParser().parse(["set", "x", "the-value"])).toThrow(/never an argument/);
  });

  it("takes the value from stdin and keeps it without the newline a terminal adds", async () => {
    const kept = new Map<string, string>();
    const outcome = await new SecretCommand(async () => "ghp_token\n")
      .execute(new SecretArgsParser().parse(["set", "github.packages-read"]), contextWith(kept));

    expect(kept.get("github.packages-read")).toBe("ghp_token");
    expect(outcome.result).toEqual({ name: "github.packages-read", store: "fake", kept: true });
  });

  it("refuses to keep nothing", async () => {
    await expect(new SecretCommand(async () => "\n").execute(new SecretArgsParser().parse(["set", "x"]), contextWith(new Map())))
      .rejects.toThrow(/no value was given/);
  });

  it("forgets by name", async () => {
    const kept = new Map([["x", "1"]]);
    const outcome = await new SecretCommand().execute(new SecretArgsParser().parse(["forget", "x"]), contextWith(kept));

    expect(kept.has("x")).toBe(false);
    expect(outcome.result.kept).toBe(false);
  });
});
