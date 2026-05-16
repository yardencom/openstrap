import type { z } from "zod";

import type { ConfigSchemaMetadataDto } from "../Domain/ConfigSchemaMetadataDto.js";

export type ZodConfigSchemaDefinition<TSchema extends z.ZodType> = {
  metadata: ConfigSchemaMetadataDto;
  schema: TSchema;
};
