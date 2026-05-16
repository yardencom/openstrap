import type { ParsedConfigDocumentDto, RawConfigDocumentDto } from "../Domain/ConfigDtos.js";

export interface ConfigDocumentParser {
  parse(document: RawConfigDocumentDto): ParsedConfigDocumentDto;
}
