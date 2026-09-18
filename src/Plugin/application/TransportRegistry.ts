import type { TransportConnector } from "@openstrap/plugin-contract";
import { OpenStrapPluginError } from "../errors/OpenStrapPluginError.js";

export type RegisteredTransport = {
  connector: TransportConnector;
  pluginName: string;
};

export class TransportRegistry {
  private readonly connectors = new Map<string, RegisteredTransport>();

  register(connector: TransportConnector, pluginName: string): void {
    TransportRegistry.validateTransportConnector(connector, pluginName);

    const existing = this.connectors.get(connector.id);
    if (existing) {
      throw new OpenStrapPluginError(
        `Transport "${connector.id}" is already registered by plugin "${existing.pluginName}"`,
      );
    }

    this.connectors.set(connector.id, {
      connector,
      pluginName,
    });
  }

  get(id: string): TransportConnector | undefined {
    return this.connectors.get(id)?.connector;
  }

  require(id: string): TransportConnector {
    const connector = this.get(id);

    if (!connector) {
      throw new OpenStrapPluginError(
        `Transport "${id}" is not registered. Available transports: ${this.list().map((item) => item.connector.id).join(", ")}`,
      );
    }

    return connector;
  }

  list(): readonly RegisteredTransport[] {
    return [...this.connectors.values()];
  }

  private static validateTransportConnector(connector: TransportConnector, pluginName: string): void {
    if (!connector.id || typeof connector.id !== "string") {
      throw new OpenStrapPluginError(`Plugin "${pluginName}" registered a transport without string id`);
    }

    if (typeof connector.connect !== "function") {
      throw new OpenStrapPluginError(`Transport "${connector.id}" must expose connect(request)`);
    }
  }
}
