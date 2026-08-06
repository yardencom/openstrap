import { factSections, shapeOf, type FactFieldKind, type FactSection, type FactShape } from "#types/Facts.js";
import type { ConfigIssue, ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
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
  private blocks?: Record<FactSection, ConfigSchemaNode<unknown | undefined>>;

  constructor(private readonly schema: ConfigSchema) {}

  /**
   * Everything required of one machine.
   *
   * A list, and two things that are true of it rather than of any entry in it: a requirement is
   * known by its id, and a thing on the machine is described once.
   */
  ofOneTarget(steps?: ConfigSchemaNode<unknown>): ConfigSchemaNode<TargetlessRequirement[]> {
    return this.schema.checked(
      this.schema.array(this.requirement(steps), { uniqueBy: ["id"] }),
      describedOnce,
    );
  }

  /**
   * A condition over the facts, with no requirement wrapped around it.
   *
   * The same words a requirement is written in, minus the name it is filed under. Anything that
   * needs to ask "is this already true of the machine" asks it in this language — a step's guard is
   * the one that does — and asks it of the same checker, so `network.ports.tcp/6443` is spelled one
   * way in the whole product.
   */
  factConditions(): ConfigSchemaNode<Record<string, unknown>> {
    return this.schema.strictObject(this.factBlocks(), {
      requireAtLeastOneField: [...factBlockNames],
    }) as ConfigSchemaNode<Record<string, unknown>>;
  }

  /**
   * @param steps What may be written inside a requirement to answer it, when anything may. Handed
   * in rather than described here: a step is not a statement about a machine, and a module about
   * comparing readings with declarations has no business knowing what one looks like.
   */
  private requirement(steps?: ConfigSchemaNode<unknown>): ConfigSchemaNode<TargetlessRequirement> {
    return this.schema.strictObject(
      {
        id: identifier(this.schema),
        optional: this.schema.optional(this.schema.boolean()),
        ...(steps === undefined ? {} : { steps: this.schema.optional(steps) }),
        ...this.factBlocks(),
      },
      {
        requireAtLeastOneField: [...factBlockNames],
      },
    ) as ConfigSchemaNode<TargetlessRequirement>;
  }

  /**
   * Every section, as what may be written about it.
   *
   * Built once and handed out by reference. Two callers want it — a requirement is these blocks
   * with a name attached, a step's guard is these blocks and nothing else — and building it twice
   * would produce two schemas that are the same schema, which nothing downstream can tell. It
   * mattered where it always does: the emitted JSON Schema is the whole model of a machine, and it
   * was in the file twice.
   */
  private factBlocks(): Record<FactSection, ConfigSchemaNode<unknown | undefined>> {
    this.blocks ??= Object.fromEntries(
      factBlockNames.map((section) => [section, this.schema.optional(this.of(shapeOf(section)))]),
    ) as Record<FactSection, ConfigSchemaNode<unknown | undefined>>;

    return this.blocks;
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

/**
 * One thing described by more than one requirement of the same target.
 *
 * A machine is read once, so `paths.config` written in two requirements is one entry in the order
 * and two claims on it — and a verdict in which the same file passes on one line and fails on
 * another. Everything wanted of a thing is written where the thing is written.
 *
 * Not a question about a requirement but about the list, which is why it is code and not shape: no
 * requirement is wrong on its own, and neither one is the wrong one. Every repetition is reported,
 * because a person fixing a blueprint would rather see all of them than run again for each.
 */
function describedOnce(requirements: readonly TargetlessRequirement[]): ConfigIssue[] {
  const written = new Map<string, string>();
  const issues: ConfigIssue[] = [];

  requirements.forEach((requirement, index) => {
    for (const [section, about] of Object.entries(requirement)) {
      if (!Object.hasOwn(factSections, section)) {
        continue;
      }

      for (const thing of thingsIn(shapeOf(section as FactSection), about, [section])) {
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

/**
 * The things a requirement describes, each as the path to it.
 *
 * A thing is something the machine has one of and that has a name: a file, a service, a port. The
 * shape of the section is what says where those are — `paths` is a map of them, `network.ports` is a
 * field holding a map of them — so the answer is found by walking the two together rather than by
 * taking the first key and hoping.
 *
 * That hope is what this cost: keys one level in were read as names, so three requirements about
 * `tcp/6443`, `tcp/5432` and `tcp/8080` were three claims on `network.ports` and a blueprint that
 * describes a cluster, a database and a server was refused.
 *
 * A field on its own is not a thing. Two requirements may both be about `cpu.cores` — one asking for
 * a minimum and another for a maximum — and neither the reading nor the verdict has anything to
 * reconcile: nothing is merged and nothing is said twice about one entry.
 */
function thingsIn(shape: FactShape, written: unknown, path: string[]): string[][] {
  if (written === null || typeof written !== "object" || typeof shape === "string" || "told" in shape) {
    return [];
  }

  // A name, and everything under it belongs to that one thing.
  if ("named" in shape || shape.open) {
    return Object.keys(written).map((name) => [...path, name]);
  }

  return Object.entries(written).flatMap(([field, value]) => {
    const fieldShape = shape.fields[field];

    return fieldShape === undefined ? [] : thingsIn(fieldShape, value, [...path, field]);
  });
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
