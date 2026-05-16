import type { z } from "zod";

import type { ParsedConfigDocumentDto, ValidatedConfigDocumentDto } from "../Domain/ConfigDtos.js";
import { ConfigValidationError } from "../Domain/ConfigErrors.js";
import type { ConfigValidator } from "../Ports/ConfigValidator.js";
import type { ZodConfigSchemaDefinition } from "./ZodConfigSchemaDefinition.js";

export class ZodConfigValidator<TSchema extends z.ZodType> implements ConfigValidator<z.output<TSchema>> {
  constructor(private readonly definition: ZodConfigSchemaDefinition<TSchema>) {}

  validate(document: ParsedConfigDocumentDto): ValidatedConfigDocumentDto<z.output<TSchema>> {
    const result = this.definition.schema.safeParse(document.value);

    if (!result.success) {
      throw new ConfigValidationError({
        kind: this.definition.metadata.kind,
        schemaId: this.definition.metadata.schemaId,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    return {
      kind: this.definition.metadata.kind,
      schemaId: this.definition.metadata.schemaId,
      source: document.source,
      config: result.data,
    };
  }
}
