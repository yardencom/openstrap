import type { ConfigIssue, ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { WrittenStep } from "./BlueprintConfig.js";

/** Exactly one of these says what the step does. It is the word a person writes. */
const actions = ["run", "exec", "write", "remove", "download"] as const;

/**
 * A step as a person writes one.
 *
 * Written the way the rest of this field writes them, because a format nobody can read is a format
 * nobody reviews:
 *
 *     steps:
 *       - run: curl -sfL https://get.k3s.io | sh -
 *
 * The word that says what to do is the key. There is no `kind` field — that is the discriminator of
 * a union in the type system, and it was in this file only because the type's internals had been
 * copied into the document a person writes. There is no `describes` either: the action says what it
 * does, and a sentence repeating it is a sentence that goes stale.
 *
 * Two ways of running something, and the difference is the one every tool in this field makes:
 * `run` is a shell line, which is what a pipe or a redirect needs; `exec` is a program and its
 * arguments, with no shell to reinterpret them. A person reaching for a pipe should not have to know
 * to write `sh -c` themselves, and a person passing a filename with a space in it should not have to
 * worry about quoting.
 */
export class StepSchema {
  constructor(private readonly schema: ConfigSchema) {}

  /**
   * The steps written in one place — inside a requirement, or beside them all.
   *
   * @param guard What may be said about the facts, which is the requirements' language. Handed in
   * rather than built here: the blueprint is the one thing that holds both and can introduce them.
   * @param answers Whether a step here names the requirements it is for. Steps written inside a
   * requirement do not: they are for the one they sit in, and a second answer to that question is
   * a second answer that can disagree.
   */
  ofOnePlace(
    guard: ConfigSchemaNode<Record<string, unknown>>,
    answers: "named" | "implied",
  ): ConfigSchemaNode<WrittenStep[]> {
    // Named by hand or not at all, and two by the same hand-written name would be one step in the
    // plan: steps are gathered by name, so the second would silently replace the first.
    return this.schema.array(this.step(guard, answers), { nonempty: true, uniqueBy: ["id"] });
  }

  private step(
    guard: ConfigSchemaNode<Record<string, unknown>>,
    answers: "named" | "implied",
  ): ConfigSchemaNode<WrittenStep> {
    return this.schema.checked(
      this.schema.strictObject({
        // Named, and everything in this field names them: Salt makes the name the key, Chef makes
        // it the first argument, every Ansible style guide requires the `name` the format leaves
        // optional. A step's name is what a plan, a pass report and a run history call it, and one
        // made up from a position renames itself the day somebody inserts a step above it.
        id: this.identifier,
        ...(answers === "named"
          ? { for: this.schema.array(this.identifier, { nonempty: true }) }
          : {}),
        guard: this.schema.optional(guard),
        run: this.schema.optional(this.schema.string({ minLength: 1 })),
        exec: this.schema.optional(this.schema.array(this.schema.string({ minLength: 1 }), { nonempty: true })),
        write: this.schema.optional(this.written),
        remove: this.schema.optional(this.removed),
        download: this.schema.optional(this.downloaded),
        cwd: this.schema.optional(this.schema.string({ minLength: 1 })),
        environment: this.schema.optional(
          this.schema.record(this.schema.string({ minLength: 1 }), this.schema.string()),
        ),
        timeoutMs: this.schema.optional(this.schema.number({ int: true, positive: true })),
      }) as ConfigSchemaNode<WrittenStep>,
      doesOneThing,
    );
  }

  private get written(): ConfigSchemaNode<{ path: string; content: string; access?: "executable" | "private" | "readable" }> {
    return this.schema.strictObject({
      path: this.path,
      content: this.schema.string(),
      access: this.schema.optional(this.access),
    });
  }

  private get removed(): ConfigSchemaNode<{ path: string; recursive?: boolean }> {
    return this.schema.strictObject({
      path: this.path,
      recursive: this.schema.optional(this.schema.boolean()),
    });
  }

  private get downloaded(): ConfigSchemaNode<{ url: string; path: string; access?: "executable" | "private" | "readable" }> {
    return this.schema.strictObject({
      url: this.schema.string({ minLength: 1, pattern: "^https://", patternMessage: "must be an https url" }),
      path: this.path,
      access: this.schema.optional(this.access),
    });
  }

  private get identifier(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._:-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', ':' or '-'",
    });
  }

  private get path(): ConfigSchemaNode<string> {
    return this.schema.string({
      minLength: 1,
      pattern: "^/",
      patternMessage: "must be an absolute path on the machine",
    });
  }

  private get access(): ConfigSchemaNode<"executable" | "private" | "readable"> {
    return this.schema.enum(["executable", "private", "readable"] as const);
  }
}

/**
 * One step, one thing.
 *
 * The cost of making the action the key rather than a field: nothing in the shape of the document
 * stops a person writing two of them, and the shape cannot be made to. Two would mean one of them
 * silently not happening, so both are refused and the person is told which two.
 */
function doesOneThing(step: WrittenStep): ConfigIssue[] {
  const written = actions.filter((action) => step[action] !== undefined);

  if (written.length === 1) {
    return [];
  }

  return [{
    path: [],
    message: written.length === 0
      ? `a step has to do one of: ${actions.join(", ")}`
      : `a step does one thing, and this one writes ${written.join(" and ")}`,
  }];
}
