import { Facts } from "../../Facts/Facts.js";
import { LocalTransport } from "../../Transport/index.js";
import type {
  FactsBackend,
  FactsBackendCollection,
  FactsBackendCollectionRequest,
} from "../Domain/FactsBackend.js";

/**
 * The backend openstrap uses when nothing else is chosen.
 *
 * It owns no knowledge about what a fact is — that belongs to the facts
 * module, and this only says which machine to read: the one openstrap runs
 * on, reached by the local transport.
 *
 * The port it fills stays worthwhile for a fundamentally different mechanism —
 * osquery answering in one query instead of ten commands — not for a second
 * way of running the same commands.
 */
export function createLocalFactsBackend(id: string): FactsBackend {
  return {
    id,
    displayName: "Local machine",
    capabilities: {
      scopes: ["host"],
      sections: [
        "os",
        "arch",
        "cpu",
        "memory",
        "storage",
        "network",
        "users",
        "packages",
        "processes",
        "services",
        "transports",
        "privileges",
        "runtimes",
        "paths",
        "tools",
        "env",
      ],
    },
    async collect(request: FactsBackendCollectionRequest): Promise<FactsBackendCollection> {
      const transport = new LocalTransport();
      const collected = [];

      for (const targetRequest of request.targets) {
        const facts = await Facts.read({
          transport,
          target: targetRequest.target,
          sections: requestedSections(targetRequest.selectors),
          paths: requestedPaths(targetRequest.selectors, request.workspaceRoot),
          now: request.now,
          attempt: request.attempt,
        });

        collected.push(...facts);
      }

      return collected;
    },
  };
}

/** Only what a requirement asked about is read; the rest is not worth the time. */
function requestedSections(selectors: Record<string, unknown>): readonly string[] | undefined {
  const asked = Object.keys(selectors);

  return asked.length > 0 ? asked : undefined;
}

function requestedPaths(selectors: Record<string, unknown>, workspaceRoot?: string): Record<string, string> {
  const paths: Record<string, string> = { home: "$HOME" };
  const asked = selectors.paths;

  if (asked && typeof asked === "object") {
    for (const name of Object.keys(asked)) {
      paths[name] = name === "workspace" ? workspaceRoot ?? "." : name;
    }
  }

  return paths;
}
