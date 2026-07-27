import { readFileSync } from "node:fs";

import { LocalTransport } from "../../Transport/index.js";
import type { FactCollectionRequest } from "../Domain/FactCollectionRequest.js";
import type {
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

type UnusedCollector = {
  collect(request: FactCollectionRequest): Promise<readonly FactCollectionItem[]>;
};

export class CollectFactsFromDefinition {
  constructor(
    private readonly transport = new LocalTransport(),
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

  private answerDeclarations(item: FactCollectionItem, definition: FactsDefinition): FactCollectionItem {
    (item.snapshot as { data: unknown }).data = Facts.answerDeclarations(
      item.snapshot.data as Record<string, unknown>,
      selectorsFromDefinition(definition),
    );

    return item;
  }

  private async collectBaseItem(
    definition: FactsDefinition,
    request: CollectFactsFromDefinitionRequest,
  ): Promise<FactCollectionItem> {
    const facts = await Facts.read({
      transport: this.transport,
      target: {
        name: "host",
        scope: "host",
        type: "host",
        displayName: "Local host",
        transport: "local",
      } satisfies FactCollectionTarget,
      sections: Object.keys(selectorsFromDefinition(definition)),
      paths: { workspace: request.workspaceRoot ?? ".", home: "$HOME" },
      now: request.now,
    });
    const item = facts[0];

    if (!item) {
      throw new Error("Facts collector returned an empty collection");
    }

    return this.answerDeclarations(structuredClone(item), definition);
  }
}
