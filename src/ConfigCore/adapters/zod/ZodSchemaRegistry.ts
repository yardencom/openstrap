import { z } from "zod";

import { ConfigSchemaNode } from "../../domain/ConfigSchemaNode.js";

export class ZodSchemaRegistry {
  private readonly schemas = new WeakMap<ConfigSchemaNode<unknown>, z.ZodType<unknown>>();

  create<TValue>(schema: z.ZodType<TValue>): ConfigSchemaNode<TValue> {
    const node = new ConfigSchemaNode<TValue>();
    this.schemas.set(node, schema as z.ZodType<unknown>);

    return node;
  }

  get<TValue>(node: ConfigSchemaNode<TValue>): z.ZodType<TValue> {
    const schema = this.schemas.get(node);

    if (!schema) {
      throw new Error("Config schema node does not belong to the Zod config schema backend");
    }

    return schema as z.ZodType<TValue>;
  }
}
