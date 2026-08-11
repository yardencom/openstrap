import type { OpenStrapCommand } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

export type RegisteredCommand = {
  command: OpenStrapCommand;
  pluginName: string;
};

/** The words this run answers to. */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(command: OpenStrapCommand, pluginName: string): void {
    CommandRegistry.validate(command, pluginName);

    const existing = this.commands.get(command.name);

    if (existing) {
      throw new OpenStrapPluginError(
        `Command "${command.name}" is already registered by plugin "${existing.pluginName}"`,
      );
    }

    this.commands.set(command.name, { command, pluginName });
  }

  get(name: string): OpenStrapCommand | undefined {
    return this.commands.get(name)?.command;
  }

  require(name: string): OpenStrapCommand {
    const command = this.get(name);

    if (!command) {
      throw new OpenStrapPluginError(
        `Unknown command "${name}". Known commands: ${this.list().map((item) => item.command.name).join(", ")}`,
      );
    }

    return command;
  }

  list(): readonly RegisteredCommand[] {
    return [...this.commands.values()];
  }

  /** The usage openstrap prints: one line per command, in the order they were registered. */
  usage(): readonly string[] {
    return this.list().map((item) => item.command.usage);
  }

  private static validate(command: OpenStrapCommand, pluginName: string): void {
    if (!command.name || typeof command.name !== "string") {
      throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a command without a name`);
    }

    // The name is the first word of a command line, so a name with a space in it could never be
    // matched: openstrap looks the first word up and hands the rest to whoever owns it.
    if (/\s/.test(command.name)) {
      throw new OpenStrapPluginError(
        `Command "${command.name}" from plugin "${pluginName}" must be one word;`
        + " everything after the first word is the command's own to read",
      );
    }

    for (const operation of ["parse", "execute", "text"] as const) {
      if (typeof command[operation] !== "function") {
        throw new OpenStrapPluginError(`Command "${command.name}" must expose ${operation}()`);
      }
    }
  }
}
