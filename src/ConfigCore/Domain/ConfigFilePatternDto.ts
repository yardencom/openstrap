import type { ConfigFormatDto } from "./ConfigFormatDto.js";

export type ConfigFilePatternTypeDto = "glob" | "regex";

export class ConfigFilePatternDto {
  readonly type: ConfigFilePatternTypeDto;
  readonly pattern: string;
  readonly format: ConfigFormatDto;
  readonly description?: string;

  constructor(params: {
    type: ConfigFilePatternTypeDto;
    pattern: string;
    format: ConfigFormatDto;
    description?: string;
  }) {
    this.type = params.type;
    this.pattern = params.pattern;
    this.format = params.format;
    this.description = params.description;
  }

  static glob(params: { pattern: string; format: ConfigFormatDto; description?: string }): ConfigFilePatternDto {
    return new ConfigFilePatternDto({
      type: "glob",
      ...params,
    });
  }

  static regex(params: { pattern: string; format: ConfigFormatDto; description?: string }): ConfigFilePatternDto {
    return new ConfigFilePatternDto({
      type: "regex",
      ...params,
    });
  }
}
