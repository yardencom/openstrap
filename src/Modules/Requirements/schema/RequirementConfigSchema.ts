import { factSections, type FactSection } from "#types/Facts.js";
import type { ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { TargetlessRequirement } from "#types/Requirements.js";

/**
 * Which keys a requirement may be written about: the sections a machine is read into, and no
 * others.
 *
 * This was a list of its own, and it had drifted both ways. `commands` and `artifacts` are facts
 * openstrap collects, and a blueprint asking about them was rejected as an unknown key. `providers`
 * and `caches` were accepted here and are not facts at all, so a requirement about them passed
 * validation and then failed for want of something to compare against.
 */
const factBlockNames = Object.keys(factSections) as readonly FactSection[];

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
    const schema = this.schema;

    return {
      os: schema.optional(schema.strictObject(
        {
          family: schema.optional(stringCondition(schema)),
          name: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          codename: schema.optional(stringCondition(schema)),
          kernel: schema.optional(stringCondition(schema)),
          edition: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["family", "name", "version", "codename", "kernel", "edition"] },
      )),
      arch: schema.optional(stringCondition(schema)),
      cpu: schema.optional(schema.strictObject(
        {
          cores: schema.optional(numberCondition(schema)),
          threads: schema.optional(numberCondition(schema)),
          model: schema.optional(stringCondition(schema)),
          vendor: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["cores", "threads", "model", "vendor"] },
      )),
      memory: schema.optional(schema.strictObject(
        {
          totalBytes: schema.optional(numberCondition(schema)),
          availableBytes: schema.optional(numberCondition(schema)),
          swapTotalBytes: schema.optional(numberCondition(schema)),
          swapUsedBytes: schema.optional(numberCondition(schema)),
          pressure: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["totalBytes", "availableBytes", "swapTotalBytes", "swapUsedBytes", "pressure"] },
      )),
      storage: schema.optional(schema.strictObject(
        {
          totalBytes: schema.optional(numberCondition(schema)),
          availableBytes: schema.optional(numberCondition(schema)),
        },
        { requireAtLeastOneField: ["totalBytes", "availableBytes"] },
      )),
      virtualization: schema.optional(schema.strictObject(
        {
          supported: schema.optional(booleanCondition(schema)),
          enabled: schema.optional(booleanCondition(schema)),
          type: schema.optional(stringCondition(schema)),
          nested: schema.optional(booleanCondition(schema)),
          reason: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["supported", "enabled", "type", "nested", "reason"] },
      )),
      network: schema.optional(schema.strictObject(
        {
          firewall: schema.optional(observedRequirement(schema)),
        },
        { requireAtLeastOneField: ["firewall"] },
      )),
      packages: schema.optional(schema.strictObject(
        {
          managers: schema.optional(namedObservedMap(schema)),
          installed: schema.optional(namedObservedMap(schema)),
        },
        { requireAtLeastOneField: ["managers", "installed"] },
      )),
      processes: schema.optional(namedObservedMap(schema)),
      services: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          manager: schema.optional(stringCondition(schema)),
          name: schema.optional(stringCondition(schema)),
          enabled: schema.optional(booleanCondition(schema)),
          running: schema.optional(booleanCondition(schema)),
          state: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "manager", "name", "enabled", "running", "state", "version"] },
      ))),
      transports: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          type: schema.optional(stringCondition(schema)),
          endpoint: schema.optional(stringCondition(schema)),
          ready: schema.optional(booleanCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          authMethods: schema.optional(stringListCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "type", "endpoint", "ready", "version", "authMethods"] },
      ))),
      privileges: schema.optional(schema.strictObject(
        {
          mode: schema.optional(stringCondition(schema)),
          sudo: schema.optional(observedRequirement(schema)),
          become: schema.optional(observedRequirement(schema)),
          admin: schema.optional(observedRequirement(schema)),
        },
        { requireAtLeastOneField: ["mode", "sudo", "become", "admin"] },
      )),
      runtimes: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          type: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          ready: schema.optional(booleanCondition(schema)),
          endpoint: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "type", "version", "ready", "endpoint"] },
      ))),
      paths: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          path: schema.optional(stringCondition(schema)),
          type: schema.optional(schema.union<unknown>([
            schema.enum(["file", "directory", "other"] as const),
            stringAssertion(schema),
          ])),
          exists: schema.optional(booleanCondition(schema)),
          readable: schema.optional(booleanCondition(schema)),
          writable: schema.optional(booleanCondition(schema)),
          executable: schema.optional(booleanCondition(schema)),
          sizeBytes: schema.optional(numberCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "path", "type", "exists", "readable", "writable", "executable", "sizeBytes"] },
      ))),
      users: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          uid: schema.optional(numberCondition(schema)),
          gid: schema.optional(numberCondition(schema)),
          home: schema.optional(stringCondition(schema)),
          shell: schema.optional(stringCondition(schema)),
          groups: schema.optional(stringListCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "uid", "gid", "home", "shell", "groups"] },
      ))),
      groups: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          gid: schema.optional(numberCondition(schema)),
          members: schema.optional(stringListCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "gid", "members"] },
      ))),
      tools: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          path: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          executable: schema.optional(booleanCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "path", "version", "executable"] },
      ))),
      env: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          value: schema.optional(stringCondition(schema)),
          redacted: schema.optional(booleanCondition(schema)),
          sensitive: schema.optional(booleanCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "value", "redacted", "sensitive"] },
      ))),
      commands: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          args: schema.optional(stringListCondition(schema)),
          stdout: schema.optional(stringCondition(schema)),
          stderr: schema.optional(stringCondition(schema)),
          exitCode: schema.optional(numberCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "args", "stdout", "stderr", "exitCode"] },
      ))),
      artifacts: schema.optional(schema.record(nameOnTheMachine(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          path: schema.optional(stringCondition(schema)),
          kind: schema.optional(stringCondition(schema)),
          type: schema.optional(stringCondition(schema)),
          sizeBytes: schema.optional(numberCondition(schema)),
          sha256: schema.optional(stringCondition(schema)),
          content: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "path", "kind", "type", "sizeBytes", "sha256", "content"] },
      ))),
    };
  }
}

function namedObservedMap(schema: ConfigSchema): ConfigSchemaNode<Record<string, unknown>> {
  return schema.record(nameOnTheMachine(schema), observedRequirement(schema));
}

function observedRequirement(schema: ConfigSchema): ConfigSchemaNode<unknown> {
  return schema.strictObject(
    {
      status: schema.optional(observedStatus(schema)),
      reason: schema.optional(stringCondition(schema)),
      message: schema.optional(stringCondition(schema)),
      passwordless: schema.optional(booleanCondition(schema)),
    },
    { requireAtLeastOneField: ["status", "reason", "message", "passwordless"] },
  );
}

/**
 * A list of strings, checked as a whole.
 *
 * `authMethods: { const: ["publickey"] }` is the way to say that a target
 * accepts nothing besides a key — the point is what is absent from the list,
 * which no per-item check can express.
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
