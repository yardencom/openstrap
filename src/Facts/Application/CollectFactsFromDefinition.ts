import { readFileSync } from "node:fs";

import { HostFacts } from "../Adapters/Local/HostFacts.js";
import { createFactCollection } from "../Domain/FactCollectionFactory.js";
import type { FactCollectionRequest } from "../Domain/FactCollectionRequest.js";
import type {
  FactCollection,
  FactCollectionItem,
  FactCollectionTarget,
  HostSystem,
} from "../Domain/Facts.js";
import { Facts } from "../Facts.js";
import { FactsDefinitionReader } from "../Definition/FactsDefinitionReader.js";
import type { FactsDefinition } from "../Definition/Domain/Entities/FactsDefinition.js";
import { collectArtifactEvidence } from "./ArtifactEvidenceCollector.js";
import { collectCommandEvidence } from "./CommandEvidenceCollector.js";
import { selectorsFromDefinition } from "./DefinitionFactSelectors.js";
import { resolveDefinitionInputs } from "./DefinitionInputs.js";
import {
  type ArtifactEvidence,
  type CommandEvidence,
  hasEvidenceError,
} from "./Evidence.js";
import { collectFileFacts } from "./FileFactCollector.js";

export type CollectFactsFromDefinitionResult = {
  definition: {
    id: string;
    version: number;
    description: string;
  };
  facts: Facts;
  evidence: {
    commands: Record<string, CommandEvidence>;
    artifacts: Record<string, ArtifactEvidence>;
  };
};

export type CollectFactsFromDefinitionRequest = {
  path: string;
  workspaceRoot: string;
  inputs?: Record<string, string>;
  now?: Date;
};

type FactCollectionCollector = {
  collect(request: FactCollectionRequest): FactCollection | Promise<FactCollection>;
};

export class CollectFactsFromDefinition {
  constructor(
    private readonly collector: FactCollectionCollector = new HostFacts(),
    private readonly definitionReader = new FactsDefinitionReader(),
  ) {}

  async collect(request: CollectFactsFromDefinitionRequest): Promise<CollectFactsFromDefinitionResult> {
    const yamlText = readFileSync(request.path, "utf8");
    const definition = this.definitionReader.parseYaml(yamlText);
    const inputs = resolveDefinitionInputs(definition, request.inputs ?? {});
    const baseItem = await this.collectBaseItem(definition, request);
    const data = baseItem.snapshot.data as HostSystem;
    const evidence = {
      commands: collectCommandEvidence(definition.commands ?? [], inputs, request.workspaceRoot),
      artifacts: collectArtifactEvidence(definition, inputs, request.workspaceRoot),
    };

    data.paths = {
      ...data.paths,
      ...collectFileFacts(definition.files ?? [], inputs, request.workspaceRoot),
    };

    const runStatus = hasEvidenceError(evidence) ? "warning" : "success";
    const facts = new Facts([{
      snapshot: baseItem.snapshot,
      run: {
        ...baseItem.run,
        status: runStatus,
      },
    }]);

    return {
      definition: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
      },
      facts,
      evidence,
    };
  }

  private collectBaseItem(
    definition: FactsDefinition,
    request: CollectFactsFromDefinitionRequest,
  ): Promise<FactCollectionItem> {
    return Promise.resolve(this.collector.collect({
      targets: [{
        target: {
          name: "host",
          scope: "host",
          type: "machine",
          displayName: "Local host",
          transport: "local",
        } satisfies FactCollectionTarget,
        selectors: selectorsFromDefinition(definition),
      }],
      workspaceRoot: request.workspaceRoot,
      now: request.now,
    })).then((collection) => {
      const factCollection = createFactCollection(collection);
      const item = structuredClone(factCollection[0]!);
      return item;
    });
  }
}
