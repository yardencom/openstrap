import { factSections, Shape, type FactFieldKind, type FactSection, type FactShape } from "#types/Facts.js";
import type { ConfigIssue, ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

const factBlockNames = Object.keys(factSections) as readonly FactSection[];

/** What a blueprint may require, built out of what a machine reports. */
export class RequirementConfigSchema {
  private blocks?: Record<FactSection, ConfigSchemaNode<unknown | undefined>>;

  constructor(private readonly schema: ConfigSchema) {}

  /** Everything required of one machine. */
  ofOneTarget(steps?: ConfigSchemaNode<unknown>): ConfigSchemaNode<TargetlessRequirement[]> {
    return this.schema.checked(
      this.schema.array(this.requirement(steps), { uniqueBy: ["id"] }),
      RequirementConfigSchema.describedOnce,
    );
  }

  /** A condition over the facts, with no requirement wrapped around it. */
  factConditions(): ConfigSchemaNode<Record<string, unknown>> {
    return this.schema.strictObject(this.factBlocks(), {
      requireAtLeastOneField: [...factBlockNames],
    }) as ConfigSchemaNode<Record<string, unknown>>;
  }

  /** @param steps What may be written inside a requirement to answer it, when anything may. */
  private requirement(steps?: ConfigSchemaNode<unknown>): ConfigSchemaNode<TargetlessRequirement> {
    return this.schema.strictObject(
      {
        id: RequirementConfigSchema.identifier(this.schema),
        optional: this.schema.optional(this.schema.boolean()),
        ...(steps === undefined ? {} : { steps: this.schema.optional(steps) }),
        ...this.factBlocks(),
      },
      {
        requireAtLeastOneField: [...factBlockNames],
      },
    ) as ConfigSchemaNode<TargetlessRequirement>;
  }

  /** Every section, as what may be written about it. */
  private factBlocks(): Record<FactSection, ConfigSchemaNode<unknown | undefined>> {
    this.blocks ??= Object.fromEntries(
      factBlockNames.map((section) => [section, this.schema.optional(this.of(Shape.of(section)))]),
    ) as Record<FactSection, ConfigSchemaNode<unknown | undefined>>;

    return this.blocks;
  }

  /** A shape as the conditions that may be written about it. */
  private of(shape: FactShape): ConfigSchemaNode<unknown> {
    if (typeof shape === "string") {
      return this.condition(shape);
    }

    // A field the reading is told takes the value and no condition: written as one, it would be
    // asking openstrap whether it looked where it was sent, and it would reach the collector as an
    // object where a path or a name was expected.
    if ("told" in shape) {
      return this.value(shape.told);
    }

    if ("named" in shape) {
      return this.schema.record(RequirementConfigSchema.nameOnTheMachine(this.schema), this.of(shape.named));
    }

    // What an open shape holds differs by machine — a display line, a firewall's own vocabulary — so
    // any name is allowed through and the comparison answers it: the fact either has that key or does
    // not, which is the truth either way.
    if (shape.open) {
      return this.schema.record(RequirementConfigSchema.nameOnTheMachine(this.schema), RequirementConfigSchema.stringCondition(this.schema));
    }

    return this.schema.strictObject(
      Object.fromEntries(
        Object.entries(shape.fields).map(([field, kind]) => [field, this.schema.optional(this.of(kind))]),
      ),
      { requireAtLeastOneField: Object.keys(shape.fields) },
    );
  }

  /** The value itself, for a field that is told rather than asked. */
  private value(kind: FactFieldKind): ConfigSchemaNode<unknown> {
    const schema = this.schema;

    switch (kind) {
      case "status":
        return RequirementConfigSchema.observedStatus(schema);
      case "boolean":
        return schema.boolean();
      case "number":
        return schema.number();
      case "numbers":
        return schema.array(schema.number());
      case "strings":
        return schema.array(schema.string());
      case "string":
        return schema.string();
    }
  }

  /** What may be said about a value of this kind. */
  private condition(kind: FactFieldKind): ConfigSchemaNode<unknown> {
    const schema = this.schema;

    switch (kind) {
      case "status":
        return RequirementConfigSchema.observedStatus(schema);
      case "boolean":
        return RequirementConfigSchema.booleanCondition(schema);
      case "number":
        return RequirementConfigSchema.numberCondition(schema);
      case "numbers":
        return RequirementConfigSchema.numberListCondition(schema);
      case "strings":
        return RequirementConfigSchema.stringListCondition(schema);
      case "string":
        return RequirementConfigSchema.stringCondition(schema);
    }
  }

  /** One thing described by more than one requirement of the same target. */
  private static describedOnce(requirements: readonly TargetlessRequirement[]): ConfigIssue[] {
    const written = new Map<string, string>();
    const issues: ConfigIssue[] = [];

    requirements.forEach((requirement, index) => {
      for (const [section, about] of Object.entries(requirement)) {
        if (!Object.hasOwn(factSections, section)) {
          continue;
        }

        for (const thing of RequirementConfigSchema.thingsIn(Shape.of(section as FactSection), about, [section])) {
          const first = written.get(thing.join("."));

          if (first === undefined) {
            written.set(thing.join("."), requirement.id);
            continue;
          }

          issues.push({
            path: [String(index), ...thing],
            message: `described by "${first}" and by "${requirement.id}"; one thing is described by one requirement`,
          });
        }
      }
    });

    return issues;
  }

  /** The things a requirement describes, each as the path to it. */
  private static thingsIn(shape: FactShape, written: unknown, path: string[]): string[][] {
    if (written === null || typeof written !== "object" || typeof shape === "string" || "told" in shape) {
      return [];
    }

    // A name, and everything under it belongs to that one thing.
    if ("named" in shape || shape.open) {
      return Object.keys(written).map((name) => [...path, name]);
    }

    return Object.entries(written).flatMap(([field, value]) => {
      const fieldShape = shape.fields[field];

      return fieldShape === undefined ? [] : RequirementConfigSchema.thingsIn(fieldShape, value, [...path, field]);
    });
  }

  private static numberListCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.array(schema.number()),
      schema.strictObject(
        {
          const: schema.optional(schema.array(schema.number())),
          contains: schema.optional(schema.number()),
        },
        { requireAtLeastOneField: ["const", "contains"] },
      ),
    ]);
  }

  /** A list of strings: matched whole, or checked for one being in it. */
  private static stringListCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.array(schema.string()),
      schema.strictObject(
        {
          const: schema.optional(schema.array(schema.string())),
          enum: schema.optional(schema.array(schema.string(), { nonempty: true })),
          contains: schema.optional(schema.string()),
        },
        { requireAtLeastOneField: ["const", "enum", "contains"] },
      ),
    ]);
  }

  private static observedStatus(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.enum(["present", "absent", "unknown", "unsupported", "error"] as const),
      RequirementConfigSchema.stringAssertion(schema),
    ]);
  }

  private static booleanCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.boolean(),
      schema.strictObject({
        const: schema.optional(schema.boolean()),
      }, { requireAtLeastOneField: ["const"] }),
    ]);
  }

  private static numberCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.number(),
      schema.strictObject(
        {
          const: schema.optional(schema.number()),
          minimum: schema.optional(schema.number()),
          maximum: schema.optional(schema.number()),
          exclusiveMinimum: schema.optional(schema.number()),
          exclusiveMaximum: schema.optional(schema.number()),
          multipleOf: schema.optional(schema.number()),
        },
        { requireAtLeastOneField: ["const", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"] },
      ),
    ]);
  }

  private static stringCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.union<unknown>([
      schema.string(),
      RequirementConfigSchema.stringAssertion(schema),
    ]);
  }

  private static stringAssertion(schema: ConfigSchema): ConfigSchemaNode<unknown> {
    return schema.strictObject(
      {
        const: schema.optional(schema.string()),
        enum: schema.optional(schema.array(schema.string(), { nonempty: true })),
        minLength: schema.optional(schema.number({ int: true, nonnegative: true })),
        maxLength: schema.optional(schema.number({ int: true, nonnegative: true })),
        pattern: schema.optional(schema.string()),
      },
      { requireAtLeastOneField: ["const", "enum", "minLength", "maxLength", "pattern"] },
    );
  }

  /** The key of a named section: the name of a thing on the machine, not an identifier of this format. */
  private static nameOnTheMachine(schema: ConfigSchema): ConfigSchemaNode<string> {
    return schema.string({
      minLength: 1,
      pattern: "^[^\\s\\x00-\\x1F](?:[^\\x00-\\x1F]*[^\\s\\x00-\\x1F])?$",
      patternMessage: "must be a name as the machine spells it, with no line breaks and no space at either end",
    });
  }

  private static identifier(schema: ConfigSchema): ConfigSchemaNode<string> {
    return schema.string({
      minLength: 1,
      pattern: "^[a-z][a-z0-9._-]*$",
      patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
    });
  }
}



/** A list of numbers: matched whole, or checked for one being in it. */








/** The name a requirement is known by in this file, which is ours to have opinions about. */
