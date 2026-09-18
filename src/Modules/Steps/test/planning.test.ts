import { describe, expect, it } from "vitest";

import { DeclaredSteps } from "../plan/DeclaredSteps.js";
import { Planning } from "../plan/Planning.js";
import type { FactSections } from "#types/Facts.js";
import type { Immutable } from "#types/Immutable.js";
import type { Resolver, Unsatisfied } from "#types/Unsatisfied.js";
import type { Step } from "#types/Step.js";

const noFacts = {} as Immutable<FactSections>;

const install: Step = {
  id: "install",
  requirements: ["the-thing"],
  action: { kind: "run", command: "true", args: [] },
};

describe("what to do about a machine that fell short", () => {
  it("makes one step out of the many failures one step answers", () => {
    const plan = new Planning([new DeclaredSteps([install])]).of([
      unsatisfied("services.thing.status"),
      unsatisfied("services.thing.running"),
      unsatisfied("services.thing.enabled"),
      unsatisfied("network.ports.tcp/6443.state"),
    ], noFacts);

    expect(plan.steps.map((step) => step.id)).toEqual(["install"]);
    expect(plan.unsatisfied).toHaveLength(4);
    expect(plan.unresolved).toEqual([]);
  });

  it("says out loud what nobody knows how to do", () => {
    const plan = new Planning([new DeclaredSteps([install])]).of([
      unsatisfied("services.thing.running"),
      { requirementId: "elbow-room", path: "memory.totalBytes", expected: 1, actual: 0 },
    ], noFacts);

    expect(plan.steps.map((step) => step.id)).toEqual(["install"]);
    expect(plan.unresolved.map((one) => one.path)).toEqual(["memory.totalBytes"]);
  });

  it("answers every failed check of the requirement it is for, whatever each one is about", () => {
    // Nothing matches a path. A step is for a requirement, so it is for all of it: the port, the
    // service and whatever else that requirement happened to ask.
    const plan = new Planning([new DeclaredSteps([install])]).of([
      unsatisfied("network.ports.tcp/5432.state"),
      unsatisfied("services.thing.running"),
      unsatisfied("services.thing.enabled"),
    ], noFacts);

    expect(plan.steps.map((step) => step.id)).toEqual(["install"]);
    expect(plan.unresolved).toEqual([]);
  });

  it("is for the requirements it names and no others", () => {
    const plan = new Planning([new DeclaredSteps([
      { ...install, requirements: ["the-thing", "the-other-thing"] },
    ])]).of([
      unsatisfied("services.thing.running"),
      { requirementId: "the-other-thing", path: "network.ports.tcp/8080.state", expected: "listening", actual: null },
      { requirementId: "a-third-thing", path: "arch", expected: "arm64", actual: "x64" },
    ], noFacts);

    expect(plan.steps.map((step) => step.id)).toEqual(["install"]);
    expect(plan.unresolved.map((one) => one.requirementId)).toEqual(["a-third-thing"]);
  });

  it("asks resolvers in turn and stops at the first that recognises the question", () => {
    const asked: string[] = [];
    const first = resolver("first", ["services.thing"], asked);
    const second = resolver("second", ["services.thing"], asked);
    const plan = new Planning([first, second]).of([unsatisfied("services.thing.running")], noFacts);

    expect(asked).toEqual(["first"]);
    expect(plan.steps.map((step) => step.id)).toEqual(["first:services.thing.running"]);
  });

  it("takes an empty answer as an answer, so a resolver may know a path and have nothing to do", () => {
    const knowsAndDoesNothing: Resolver = { id: "quiet", resolve: () => [] };
    const plan = new Planning([knowsAndDoesNothing, new DeclaredSteps([install])])
      .of([unsatisfied("services.thing.running")], noFacts);

    expect(plan.steps).toEqual([]);
    expect(plan.unresolved).toEqual([]);
  });
});

function unsatisfied(path: string): Unsatisfied {
  return { requirementId: "the-thing", path, expected: true, actual: null };
}

function resolver(id: string, paths: readonly string[], asked: string[]): Resolver {
  return {
    id,
    resolve(one) {
      if (!paths.some((path) => one.path.startsWith(path))) {
        return undefined;
      }

      asked.push(id);

      return [{ ...install, id: `${id}:${one.path}` }];
    },
  };
}
