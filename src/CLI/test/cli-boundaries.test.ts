import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A cycle means two files each need the other to be understood, so neither can be read first and
 * neither can be moved alone. This one caught itself: the file holding the `Output` contract also
 * chose between its implementations, and they import the contract.
 */
describe("CLI imports", () => {
  it("keeps one class to a file", () => {
    // A file with two classes in it cannot be named after what it holds, and the second one is
    // always found by opening the first. Error classes are classes.
    const crowded = sourceFiles(join(process.cwd(), "src"))
      .filter((file) => !file.includes(".test."))
      .filter((file) => [...readFileSync(file, "utf8").matchAll(/^(?:export )?(?:abstract )?class /gm)].length > 1)
      .map((file) => file.slice(file.indexOf("/src/") + 1));

    expect(crowded).toEqual([]);
  });

  it("has no cycles", () => {
    const graph = importGraph(join(process.cwd(), "src"));

    expect(cyclesIn(graph)).toEqual([]);
  });
});

function importGraph(root: string): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const file of sourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    const targets = [...source.matchAll(/from\s+"(\.[^"]+)"/g)]
      .map((match) => resolve(dirname(file), match[1]!.replace(/\.js$/, ".ts")))
      .filter((target) => graphable(target));

    graph.set(file, targets);
  }

  return graph;
}

function cyclesIn(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const open = new Set<string>();
  const closed = new Set<string>();

  const walk = (node: string, stack: string[]): void => {
    open.add(node);

    for (const target of graph.get(node) ?? []) {
      if (open.has(target)) {
        cycles.push([...stack.slice(stack.indexOf(target)), target].map(relative));
      } else if (!closed.has(target)) {
        walk(target, [...stack, target]);
      }
    }

    open.delete(node);
    closed.add(node);
  };

  for (const node of graph.keys()) {
    if (!closed.has(node)) {
      walk(node, [node]);
    }
  }

  return cycles;
}

function graphable(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith(".ts") && !path.includes(".test.") ? [path] : [];
  });
}

function relative(file: string): string {
  return file.slice(file.indexOf("/src/") + 1);
}
