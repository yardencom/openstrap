import type { ParsedConfigDocumentDto, RawConfigDocumentDto, ValidatedConfigDocumentDto } from "../Domain/ConfigDtos.js";
import { YamlConfigDocumentParser } from "../Adapters/YamlConfigDocumentParser.js";
import type { ConfigDocumentParser } from "../Ports/ConfigDocumentParser.js";
import type { ConfigValidator } from "../Ports/ConfigValidator.js";

export class ConfigLoader<TConfig> {
  constructor(
    private readonly validator: ConfigValidator<TConfig>,
    private readonly parser: ConfigDocumentParser = new YamlConfigDocumentParser(),
  ) {}

  load(document: RawConfigDocumentDto): ValidatedConfigDocumentDto<TConfig> {
    return this.validator.validate(this.parser.parse(document));
  }

  validateParsed(document: ParsedConfigDocumentDto): ValidatedConfigDocumentDto<TConfig> {
    return this.validator.validate(document);
  }
}
