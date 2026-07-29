import { z } from "zod";

import type { ConfigSchemaNode } from "../../domain/ConfigSchemaNode.js";
import type { ZodSchemaMetadataRegistry } from "./ZodSchemaMetadataRegistry.js";

export function createZodDiscriminatedUnion(
  discriminator: string,
  variants: Record<string, ConfigSchemaNode<object>>,
  metadata: ZodSchemaMetadataRegistry,
  unwrap: (variant: ConfigSchemaNode<object>) => z.ZodType,
): z.ZodType {
  const variantSchemas = Object.entries(variants).map(([variantKey, variant]) => {
    assertVariantDiscriminator(discriminator, variantKey, variant, metadata);
    return unwrap(variant);
  });

  const discriminatedUnion = z.discriminatedUnion as unknown as (
    discriminator: string,
    variants: [z.ZodType, z.ZodType, ...z.ZodType[]],
  ) => z.ZodType;

  return discriminatedUnion(discriminator, asUnionTuple(variantSchemas));
}

function assertVariantDiscriminator(
  discriminator: string,
  variantKey: string,
  variant: ConfigSchemaNode<object>,
  metadata: ZodSchemaMetadataRegistry,
): void {
  const discriminatorLiteral = metadata.getFieldLiteralValue(variant, discriminator);

  if (discriminatorLiteral === undefined) {
    throw new Error(`Config discriminated union variant '${variantKey}' must declare discriminator '${discriminator}'`);
  }

  if (discriminatorLiteral !== variantKey) {
    throw new Error(
      `Config discriminated union variant '${variantKey}' must use discriminator '${discriminator}' literal '${variantKey}'`,
    );
  }
}

function asUnionTuple<TValue>(values: readonly TValue[]): [TValue, TValue, ...TValue[]] {
  if (values.length < 2) {
    throw new Error("Expected at least two union variants");
  }

  return values as [TValue, TValue, ...TValue[]];
}
