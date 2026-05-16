import { parseDocument } from "yaml";

import type { ParsedConfigDocumentDto, RawConfigDocumentDto } from "../Domain/ConfigDtos.js";
import { ConfigParseError } from "../Domain/ConfigErrors.js";
import type { ConfigDocumentParser } from "../Ports/ConfigDocumentParser.js";

export class YamlConfigDocumentParser implements ConfigDocumentParser {
  parse(document: RawConfigDocumentDto): ParsedConfigDocumentDto {
    if (document.format !== "yaml") {
      throw new ConfigParseError([
        {
          path: [],
          message: `Unsupported config format '${document.format}'`,
          code: "UNSUPPORTED_FORMAT",
        },
      ]);
    }

    const parsedDocument = parseDocument(document.content);

    if (parsedDocument.errors.length > 0) {
      throw new ConfigParseError(
        parsedDocument.errors.map((error) => ({
          path: [],
          message: error.message,
          code: "YAML_PARSE_ERROR",
        })),
      );
    }

    return {
      format: document.format,
      source: document.source,
      value: parsedDocument.toJS(),
    };
  }
}
