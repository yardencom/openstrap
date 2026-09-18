import { describe, expect, it } from "vitest";

import { Blueprints } from "../index.js";
import { WrittenSteps } from "../WrittenSteps.js";

const blueprints = new Blueprints();

const written = `
targets:
  server:
    requirements:
      - id: kubernetes-running
        network: { ports: { tcp/6443: { state: listening } } }
        steps:
          - id: install-it
            run: curl -sfL https://example.test/install | sh -
          - id: link-it
            exec: [ln, -sf, /usr/local/bin/thing, /usr/local/bin/other]
            timeoutMs: 30000
      - id: config-in-place
        paths: { config: { path: /etc/thing.conf, exists: true } }
        steps:
          - id: write-it
            write: { path: /etc/thing.conf, content: "a = b\\n", access: private }
          - id: fetch-it
            download: { url: https://example.test/extra.conf, path: /etc/extra.conf }
          - id: clear-it
            remove: { path: /etc/old.conf, recursive: true }
            guard: { paths: { config: { path: /etc/thing.conf, exists: true } } }
    steps:
      - id: bring-it-all-up
        for: [kubernetes-running, config-in-place]
        run: systemd-run-everything
        cwd: /srv
        environment: { KEY: value }
`;

/**
 * A blueprint openstrap writes for the openstrap it delivered.
 *
 * The one place the two shapes of a step have to agree in both directions. Reading a blueprint turns
 * what a person wrote into what a plan is made of; sending steps to another machine turns them back,
 * because what arrives there is read by the same loader against the same schema.
 *
 * Without this, the far side refuses the file: `{ id, requirements, action: { kind: "run", … } }` is
 * not a step anybody may write, and openstrap over there is right to say so. Nothing here caught it,
 * because the only test of delivery hands the blueprint to a transport that does not read it.
 */
describe("steps sent to a machine openstrap is not on", () => {
  it("are written in the shape the openstrap over there will read", () => {
    const target = blueprints.load({ content: written }).targets.server!;
    const sent = JSON.stringify({
      targets: { host: { requirements: target.requirements, steps: WrittenSteps.asWritten(target.steps!) } },
    });

    const arrived = blueprints.load({ content: sent }).targets.host!;

    expect(arrived.steps).toEqual(target.steps);
  });

  it("keep a shell line a shell line, and a program a program", () => {
    const target = blueprints.load({ content: written }).targets.server!;
    const sent = WrittenSteps.asWritten(target.steps!);

    expect(sent.find((step) => step.id === "install-it"))
      .toMatchObject({ run: "curl -sfL https://example.test/install | sh -" });
    expect(sent.find((step) => step.id === "link-it"))
      .toMatchObject({ exec: ["ln", "-sf", "/usr/local/bin/thing", "/usr/local/bin/other"], timeoutMs: 30000 });
  });

  it("say what each step is for by name, because the requirements travel with them", () => {
    const target = blueprints.load({ content: written }).targets.server!;
    const sent = WrittenSteps.asWritten(target.steps!);

    // Everything arrives beside the requirements rather than inside them, so everything names what
    // it is for — including the steps that were written inside one and had it implied.
    expect(sent.map((step) => step.for)).toEqual([
      ["kubernetes-running"],
      ["kubernetes-running"],
      ["config-in-place"],
      ["config-in-place"],
      ["config-in-place"],
      ["kubernetes-running", "config-in-place"],
    ]);
  });
});
