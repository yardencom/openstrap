import type { ConfigIssue, ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { StepValue } from "#types/Action.js";
import type { WrittenStep } from "./BlueprintConfig.js";

/** Exactly one of these says what the step does. It is the word a person writes. */
const actions = ["run", "exec", "write", "remove", "download"] as const;

/** A step as a person writes one. */
export class StepSchema {
  constructor(private readonly schema: ConfigSchema) {}

  /** The steps written in one place — inside a requirement, or beside them all. */
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
          this.schema.record(this.schema.string({ minLength: 1 }), this.value),
        ),
        timeoutMs: this.schema.optional(this.schema.number({ int: true, positive: true })),
      }) as ConfigSchemaNode<WrittenStep>,
      StepSchema.doesOneThing,
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

  /** A value a step is given: the value, or the name of a secret to fetch it by. */
  private get value(): ConfigSchemaNode<StepValue> {
    return this.schema.union<StepValue>([
      this.schema.string(),
      this.schema.strictObject({ secret: this.schema.string({ minLength: 1 }) }),
    ]);
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

  /** One step, one thing. */
  private static doesOneThing(step: WrittenStep): ConfigIssue[] {
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
}
