import type { ConfigFormatDto } from "./ConfigFormatDto.js";

export type ConfigSourceDto =
  | {
      type: "inline";
      name: string;
    }
  | {
      type: "file";
      path: string;
    };

export type RawConfigDocumentDto = {
  format: ConfigFormatDto;
  content: string;
  source?: ConfigSourceDto;
};

export type ParsedConfigDocumentDto = {
  format: ConfigFormatDto;
  value: unknown;
  source?: ConfigSourceDto;
};

export type ConfigIssueDto = {
  path: string[];
  message: string;
  code?: string;
};

export type ValidatedConfigDocumentDto<TConfig> = {
  kind: string;
  schemaId: string;
  config: TConfig;
  source?: ConfigSourceDto;
};

export type JsonSchemaDocumentDto = Record<string, unknown> & {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
};
