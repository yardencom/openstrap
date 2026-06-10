import type { FactsDefinition } from "../Definition/Domain/Entities/FactsDefinition.js";

export function selectorsFromDefinition(definition: FactsDefinition): Record<string, unknown> {
  const selectors: Record<string, unknown> = {};

  if (definition.processes !== undefined) {
    selectors.processes = Object.fromEntries(definition.processes.map((item) => [item.id, {
      name: item.name,
      command: item.command,
      redaction: item.redaction,
    }]));
  }

  if (definition.services !== undefined) {
    selectors.services = Object.fromEntries(definition.services.map((item) => [item.id, {
      name: item.name,
      manager: item.manager,
    }]));
  }

  if (definition.files !== undefined) {
    selectors.paths = Object.fromEntries(definition.files.map((item) => [item.id, {}]));
  }

  return selectors;
}
