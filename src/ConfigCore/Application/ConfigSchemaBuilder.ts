import type {
  ConfigDiscriminatedUnionSchemaNodeDto,
  ConfigLiteralSchemaNodeDto,
  ConfigNumberSchemaNodeDto,
  ConfigObjectSchemaNodeDto,
  ConfigSchemaLiteralValueDto,
  ConfigSchemaNodeDto,
  ConfigSchemaRefinementDto,
  ConfigStringSchemaNodeDto,
} from "../Domain/ConfigSchemaNodes.js";

type ConfigEnumSource = readonly string[] | Record<string, string>;

export const configSchema = {
  string(params: { minLength?: number; pattern?: string; patternMessage?: string } = {}): ConfigStringSchemaNodeDto {
    return {
      kind: "string",
      ...params,
    };
  },

  number(params: { int?: boolean; positive?: boolean; nonnegative?: boolean } = {}): ConfigNumberSchemaNodeDto {
    return {
      kind: "number",
      ...params,
    };
  },

  boolean(): ConfigSchemaNodeDto {
    return {
      kind: "boolean",
    };
  },

  unknown(): ConfigSchemaNodeDto {
    return {
      kind: "unknown",
    };
  },

  literal(value: ConfigSchemaLiteralValueDto): ConfigLiteralSchemaNodeDto {
    return {
      kind: "literal",
      value,
    };
  },

  enum(values: ConfigEnumSource): ConfigSchemaNodeDto {
    return {
      kind: "enum",
      values: Array.isArray(values) ? values : Object.values(values),
    };
  },

  array(
    element: ConfigSchemaNodeDto,
    params: { nonempty?: boolean; uniqueFields?: readonly string[] } = {},
  ): ConfigSchemaNodeDto {
    return {
      kind: "array",
      element,
      ...params,
    };
  },

  strictObject(
    properties: Record<string, ConfigSchemaNodeDto>,
    params: { requireAtLeastOneField?: readonly string[] } = {},
  ): ConfigObjectSchemaNodeDto {
    return {
      kind: "object",
      properties,
      additionalProperties: false,
      ...params,
    };
  },

  record(key: ConfigStringSchemaNodeDto, value: ConfigSchemaNodeDto): ConfigSchemaNodeDto {
    return {
      kind: "record",
      key,
      value,
    };
  },

  union(variants: readonly ConfigSchemaNodeDto[]): ConfigSchemaNodeDto {
    return {
      kind: "union",
      variants,
    };
  },

  discriminatedUnion(
    discriminator: string,
    variants: Record<string, ConfigObjectSchemaNodeDto>,
  ): ConfigDiscriminatedUnionSchemaNodeDto {
    return {
      kind: "discriminatedUnion",
      discriminator,
      variants,
    };
  },

  optional<TNode extends ConfigSchemaNodeDto>(node: TNode): TNode {
    return {
      ...node,
      isOptional: true,
    };
  },

  defaulted<TNode extends ConfigSchemaNodeDto>(node: TNode, defaultValue: unknown): TNode {
    return {
      ...node,
      hasDefault: true,
      defaultValue,
    };
  },

  refine<TNode extends ConfigSchemaNodeDto>(node: TNode, refinement: ConfigSchemaRefinementDto): TNode {
    return {
      ...node,
      refinements: [...(node.refinements ?? []), refinement],
    };
  },
};
