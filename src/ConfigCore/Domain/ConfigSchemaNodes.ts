import type { ConfigIssueDto } from "./ConfigDtos.js";

export type ConfigSchemaLiteralValueDto = string | number | boolean | null;

export type ConfigSchemaRefinementContextDto = {
  addIssue(issue: Omit<ConfigIssueDto, "path"> & { path?: string[] }): void;
};

export type ConfigSchemaRefinementDto = (value: unknown, context: ConfigSchemaRefinementContextDto) => void;

export type ConfigSchemaBaseNodeDto = {
  isOptional?: boolean;
  hasDefault?: boolean;
  defaultValue?: unknown;
  refinements?: ConfigSchemaRefinementDto[];
};

export type ConfigStringSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "string";
  minLength?: number;
  pattern?: string;
  patternMessage?: string;
};

export type ConfigNumberSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "number";
  int?: boolean;
  positive?: boolean;
  nonnegative?: boolean;
};

export type ConfigBooleanSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "boolean";
};

export type ConfigUnknownSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "unknown";
};

export type ConfigLiteralSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "literal";
  value: ConfigSchemaLiteralValueDto;
};

export type ConfigEnumSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "enum";
  values: readonly string[];
};

export type ConfigArraySchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "array";
  element: ConfigSchemaNodeDto;
  nonempty?: boolean;
  uniqueFields?: readonly string[];
};

export type ConfigObjectSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "object";
  properties: Record<string, ConfigSchemaNodeDto>;
  additionalProperties?: boolean;
  requireAtLeastOneField?: readonly string[];
};

export type ConfigRecordSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "record";
  key: ConfigStringSchemaNodeDto;
  value: ConfigSchemaNodeDto;
};

export type ConfigUnionSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "union";
  variants: readonly ConfigSchemaNodeDto[];
};

export type ConfigDiscriminatedUnionSchemaNodeDto = ConfigSchemaBaseNodeDto & {
  kind: "discriminatedUnion";
  discriminator: string;
  variants: Record<string, ConfigObjectSchemaNodeDto>;
};

export type ConfigSchemaNodeDto =
  | ConfigStringSchemaNodeDto
  | ConfigNumberSchemaNodeDto
  | ConfigBooleanSchemaNodeDto
  | ConfigUnknownSchemaNodeDto
  | ConfigLiteralSchemaNodeDto
  | ConfigEnumSchemaNodeDto
  | ConfigArraySchemaNodeDto
  | ConfigObjectSchemaNodeDto
  | ConfigRecordSchemaNodeDto
  | ConfigUnionSchemaNodeDto
  | ConfigDiscriminatedUnionSchemaNodeDto;
