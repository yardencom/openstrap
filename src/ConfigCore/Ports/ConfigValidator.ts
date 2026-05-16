import type { ParsedConfigDocumentDto, ValidatedConfigDocumentDto } from "../Domain/ConfigDtos.js";

export interface ConfigValidator<TConfig> {
  validate(document: ParsedConfigDocumentDto): ValidatedConfigDocumentDto<TConfig>;
}
