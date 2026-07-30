import { describe, expect, it } from "vitest";

import { CliArgsParser } from "../arguments/index.js";
import { CommandArguments } from "../arguments/CommandArguments.js";

const parse = (...args: string[]) => new CliArgsParser().parse(["node", "openstrap", ...args]);

describe("reading the options of a command", () => {
  it("accepts an option written either way", () => {
    const separate = new CommandArguments(["--config", "a.yaml"], { values: ["config"] });
    const joined = new CommandArguments(["--config=a.yaml"], { values: ["config"] });

    expect(separate.value("config")).toBe("a.yaml");
    expect(joined.value("config")).toBe("a.yaml");
  });

  it("collects an option given more than once", () => {
    const read = new CommandArguments(["--plugin", "a", "--plugin=b"], { repeated: ["plugin"] });

    expect(read.values("plugin")).toEqual(["a", "b"]);
  });

  it("lets the last value win for an option that carries one", () => {
    const read = new CommandArguments(["--config=a", "--config=b"], { values: ["config"] });

    expect(read.value("config")).toBe("b");
  });

  it("keeps everything that is not an option, in order", () => {
    const read = new CommandArguments(["vm", "--json", "ubuntu"], { flags: ["json"] });

    expect(read.positionals).toEqual(["vm", "ubuntu"]);
  });

  it("refuses an option this command does not take, rather than taking it for a name", () => {
    // A mistyped `--jsno` quietly becoming a target name is worse than being told.
    expect(() => new CommandArguments(["--jsno"], { flags: ["json"] })).toThrow('Unknown option "--jsno"');
  });

  it("refuses an option that needs a value and was given none", () => {
    expect(() => new CommandArguments(["--config"], { values: ["config"] })).toThrow("Missing value for --config");
    expect(() => new CommandArguments(["--config="], { values: ["config"] })).toThrow("Missing value for --config");
  });

  it("refuses a value given to a flag", () => {
    expect(() => new CommandArguments(["--json=yes"], { flags: ["json"] })).toThrow("Option --json takes no value");
  });

  it("answers false and nothing for options that were not given", () => {
    const read = new CommandArguments([], { flags: ["json"], values: ["config"], repeated: ["plugin"] });

    expect(read.flag("json")).toBe(false);
    expect(read.value("config")).toBeUndefined();
    expect(read.values("plugin")).toEqual([]);
  });
});

describe("choosing who reads the command line", () => {
  it("refuses a command line with no command", () => {
    expect(() => parse()).toThrow("Missing command");
  });

  it("names the command it does not know", () => {
    expect(() => parse("nonsense")).toThrow('Unknown command "nonsense"');
  });

  it("names the facts command it does not know", () => {
    expect(() => parse("facts", "sprinkle")).toThrow('Unknown facts command "sprinkle"');
    expect(() => parse("facts")).toThrow("Missing facts command");
  });
});

describe("openstrap run", () => {
  it("takes an optional config path and the shared runtime options", () => {
    expect(parse("run", "app.yaml", "--json", "--plugin", "./p.mjs", "--runtime-config", "r.mjs")).toEqual({
      command: "run",
      configPath: "app.yaml",
      json: true,
      pluginSpecifiers: ["./p.mjs"],
      runtimeConfigPath: "r.mjs",
    });
  });

  it("runs with nothing given", () => {
    expect(parse("run")).toMatchObject({ command: "run", configPath: undefined, json: false });
  });

  it("takes one config path and not two", () => {
    expect(() => parse("run", "a.yaml", "b.yaml")).toThrow("Only one config path");
  });
});

describe("openstrap create", () => {
  it("takes a kind, a target, and its own options", () => {
    expect(parse("create", "vm", "ubuntu-vm", "--config", "bp.yaml", "--host-port=2223")).toEqual({
      command: "create",
      kind: "vm",
      target: "ubuntu-vm",
      configPath: "bp.yaml",
      hostPort: 2223,
      repin: false,
      json: false,
      pluginSpecifiers: [],
      runtimeConfigPath: undefined,
    });
  });

  it("says what it can create when asked for something else", () => {
    expect(() => parse("create", "toaster", "x")).toThrow('Unknown kind "toaster". Known kinds: vm');
  });

  it("needs both a kind and a target", () => {
    expect(() => parse("create", "vm")).toThrow("Usage: openstrap create vm <target>");
    expect(() => parse("create")).toThrow("Usage: openstrap create vm <target>");
  });

  it("creates one machine at a time", () => {
    expect(() => parse("create", "vm", "a", "b")).toThrow("Only one target can be created");
  });

  it("refuses a host port that is not a port", () => {
    expect(() => parse("create", "vm", "a", "--host-port", "http")).toThrow("--host-port needs a port number");
  });
});

describe("openstrap connect", () => {
  it("takes a target and an optional command to run", () => {
    expect(parse("connect", "ubuntu-vm", "--run", "uname -a")).toEqual({
      command: "connect",
      target: "ubuntu-vm",
      run: "uname -a",
      pluginSpecifiers: [],
      runtimeConfigPath: undefined,
    });
  });

  it("needs a target", () => {
    expect(() => parse("connect")).toThrow("Usage: openstrap connect <target>");
  });

  it("connects to one machine at a time", () => {
    expect(() => parse("connect", "a", "b")).toThrow("Only one target can be connected to");
  });
});

describe("openstrap facts collect", () => {
  it("reads the machine it was told to read and takes no file", () => {
    expect(parse("facts", "collect", "host", "--json")).toEqual({
      command: "facts.collect",
      target: "host",
      json: true,
      order: undefined,
      pluginSpecifiers: [],
      runtimeConfigPath: undefined,
    });
  });

  it("needs to be told which machine, because there is more than one it could be", () => {
    expect(() => parse("facts", "collect")).toThrow("Missing machine");
  });

  it("takes the name of a machine openstrap created", () => {
    expect(parse("facts", "collect", "ubuntu-vm")).toMatchObject({ command: "facts.collect", target: "ubuntu-vm" });
  });

  it("takes the order openstrap hands it when openstrap is the caller", () => {
    const order = {
      target: { name: "ubuntu-vm", scope: "machine", type: "vm" },
      declare: { os: {} },
      channel: { type: "ssh", authMethods: ["publickey"] },
    };
    const encoded = Buffer.from(JSON.stringify(order)).toString("base64");

    expect(parse("facts", "collect", "host", "--order", encoded)).toMatchObject({
      command: "facts.collect",
      order: { ...order, now: undefined },
    });
  });

  it("refuses an order it cannot read, rather than reading the wrong machine", () => {
    expect(() => parse("facts", "collect", "host", "--order", "not base64 json")).toThrow("--order must");
    expect(() => parse("facts", "collect", "host", "--order", Buffer.from("[]").toString("base64")))
      .toThrow("--order must decode to an order");
    expect(() => parse("facts", "collect", "host", "--order", Buffer.from("{}").toString("base64")))
      .toThrow("--order must name the target it is about");
  });

  it("takes no definition file, because a facts file of its own does not exist", () => {
    expect(() => parse("facts", "collect", "host", "facts.yaml"))
      .toThrow('Unexpected argument "facts.yaml"');
  });

  it("no longer lets a plugin replace how a machine is read", () => {
    expect(() => parse("facts", "collect", "host", "--facts-backend", "x"))
      .toThrow('Unknown option "--facts-backend"');
  });
});
