import { bindRequirementsToTarget } from "../../Requirements/index.js";
import type { OpenStrapBlueprint } from "../Domain/Blueprint.js";
import {
  isExplicitBlueprintDocument,
  isHostBlueprintDocument,
  type BlueprintDocument,
} from "../Domain/BlueprintDocument.js";

export class BlueprintTransformer {
  transform(document: BlueprintDocument): OpenStrapBlueprint {
    if (isHostBlueprintDocument(document)) {
      return {
        targets: [
          {
            name: "host",
            scope: "host",
            type: "machine",
            displayName: document.host.displayName ?? "Local host",
            transport: "local",
          },
        ],
        requirements: bindRequirementsToTarget(document.host.requirements, "host"),
      };
    }

    if (isExplicitBlueprintDocument(document)) {
      return document;
    }

    return exhaustiveDocumentCheck(document);
  }
}

function exhaustiveDocumentCheck(value: never): never {
  throw new Error(`Unsupported blueprint document shape: ${JSON.stringify(value)}`);
}
