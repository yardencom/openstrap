import { OpenStrapPluginError } from "../../Plugin/index.js";

export class CliErrors {
  format(error: unknown): string {
    if (error instanceof OpenStrapPluginError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  usage(): string {
    return [
      "Usage:",
      "  openstrap run [configPath] [--json] [--runtime-config path] [--plugin specifier] [--facts-backend id]",
      "  openstrap create vm <target> [--config path] [--host-port n] [--json] [--plugin specifier]",
      "  openstrap facts collect host [factsPath] [--json] [--input key=value] [--runtime-config path] [--plugin specifier] [--facts-backend id]",
    ].join("\n");
  }
}
