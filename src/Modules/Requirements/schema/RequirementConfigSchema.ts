import { factSections, shapeOf, type FactFieldKind, type FactSection, type FactShape } from "#types/Facts.js";
import type { ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

const factBlockNames = Object.keys(factSections) as readonly FactSection[];

/**
 * What a blueprint may require, built out of what a machine reports.
 *
 * A requirement is a condition over a fact, so this file has nothing of its own to say about which
 * fields exist: it walks the shape of each section and gives every field the conditions its kind
 * allows. Add a field to the facts model and it becomes requirable; take one away and requiring it
 * stops validating. Neither can be done alone any more.
 *
 * It was four hundred lines listing every field of every section a second time, and that copy had
 * drifted in both directions: `pid`, `pids`, and every field of `network.ports` were reported by every
 * reading and no blueprint could ask about them, while other keys were accepted here on the strength
 * of somebody having remembered to add them. Nothing compared the two lists, because there was
 * nothing to compare them against.
 *
 * What remains here is the grammar of a condition — what may be said about a string, a number, a
 * list, a status. That is this module's own, because it is about comparing rather than about machines.
 */
export class RequirementConfigSchema {
  constructor(private readonly schema: ConfigSchema) {}

  withoutTarget(): ConfigSchemaNode<TargetlessRequirement> {
    return this.schema.strictObject(
      {
        id: identifier(this.schema),
        optional: this.schema.optional(this.schema.boolean()),
        ...this.factBlocks(),
      },
      {
        requireAtLeastOneField: [...factBlockNames],
      },
    ) as ConfigSchemaNode<TargetlessRequirement>;
  }

  private factBlocks(): Record<FactSection, ConfigSchemaNode<unknown | undefined>> {
    return Object.fromEntries(
      factBlockNames.map((section) => [section, this.schema.optional(this.of(shapeOf(section)))]),
    ) as Record<FactSection, ConfigSchemaNode<unknown | undefined>>;
  }

  /**
   * A shape as the conditions that may be written about it.
   *
   * Three cases, because a shape has three: a leaf is a condition, a map is a condition per name, an
   * object is a condition per field. Nesting falls out of the recursion — `network.ports.tcp/6443` is
   * a map inside an object, and nobody had to say so twice.
   */
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
      return this.schema.record(nameOnTheMachine(this.schema), this.of(shape.named));
    }

    // What an open shape holds differs by machine — a display line, a firewall's own vocabulary — so
    // any name is allowed through and the comparison answers it: the fact either has that key or does
    // not, which is the truth either way.
    if (shape.open) {
      return this.schema.record(nameOnTheMachine(this.schema), stringCondition(this.schema));
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
        return observedStatus(schema);
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
        return observedStatus(schema);
      case "boolean":
        return booleanCondition(schema);
      case "number":
        return numberCondition(schema);
      case "numbers":
        return numberListCondition(schema);
      case "strings":
        return stringListCondition(schema);
      case "string":
        return stringCondition(schema);
    }
  }
}

/** A list of numbers: matched whole, or checked for one being in it. */
function numberListCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
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

/**
 * A list of strings: matched whole, or checked for one being in it.
 *
 * `authMethods: { const: ["publickey"] }` is how to say that a machine accepts nothing besides a key
 * — the point is what is absent from the list, which no per-item check can express.
 */
function stringListCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
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

function observedStatus(schema: ConfigSchema): ConfigSchemaNode<unknown> {
  return schema.union<unknown>([
    schema.enum(["present", "absent", "unknown", "unsupported", "error"] as const),
    stringAssertion(schema),
  ]);
}

function booleanCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
  return schema.union<unknown>([
    schema.boolean(),
    schema.strictObject({
      const: schema.optional(schema.boolean()),
    }, { requireAtLeastOneField: ["const"] }),
  ]);
}

function numberCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
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

function stringCondition(schema: ConfigSchema): ConfigSchemaNode<unknown> {
  return schema.union<unknown>([
    schema.string(),
    stringAssertion(schema),
  ]);
}

function stringAssertion(schema: ConfigSchema): ConfigSchemaNode<unknown> {
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

/**
 * The key of a named section: the name of a thing that is on the machine.
 *
 * Not an identifier in this file format, which is what it used to be checked as — lowercase, no
 * slashes. Environment variables are written in capitals, a path is a path, an artifact is a file
 * name, so `HOME`, `/etc/ssh/sshd_config` and `package.json` were all rejected before anything ran.
 * They are somebody else's names and this is not the place to have opinions about them.
 *
 * What is still refused is a name that cannot be one: empty, wrapped in spaces, or carrying a line
 * break — each of those is a typo that would otherwise match nothing and be reported as an absence.
 */
function nameOnTheMachine(schema: ConfigSchema): ConfigSchemaNode<string> {
  return schema.string({
    minLength: 1,
    pattern: "^[^\\s\\x00-\\x1F](?:[^\\x00-\\x1F]*[^\\s\\x00-\\x1F])?$",
    patternMessage: "must be a name as the machine spells it, with no line breaks and no space at either end",
  });
}

/** The name a requirement is known by in this file, which is ours to have opinions about. */
function identifier(schema: ConfigSchema): ConfigSchemaNode<string> {
  return schema.string({
    minLength: 1,
    pattern: "^[a-z][a-z0-9._-]*$",
    patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
  });
}
