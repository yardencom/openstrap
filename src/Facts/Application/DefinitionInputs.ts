import type { FactsDefinition } from "../Definition/Domain/Entities/FactsDefinition.js";

export function resolveDefinitionInputs(
  definition: FactsDefinition,
  overrides: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, input] of Object.entries(definition.inputs ?? {})) {
    if (input.default !== undefined) {
      values[key] = String(input.default);
    }
  }

  return {
    ...values,
    ...overrides,
  };
}

export function interpolateDefinitionInput(value: string, inputs: Record<string, string>): string {
  return value.replace(/\{\{\s*inputs\.([a-z][a-z0-9._-]*)\s*\}\}/g, (_, key: string) => inputs[key] ?? "");
}
