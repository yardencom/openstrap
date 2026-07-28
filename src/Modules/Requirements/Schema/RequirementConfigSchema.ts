import type { ConfigSchema, ConfigSchemaNode } from "../../../ConfigCore/index.js";
import type { TargetlessRequirement } from "../Domain/Requirements.js";

const factBlockNames = [
  "os",
  "arch",
  "cpu",
  "memory",
  "storage",
  "virtualization",
  "network",
  "users",
  "groups",
  "packages",
  "processes",
  "services",
  "transports",
  "privileges",
  "runtimes",
  "paths",
  "tools",
  "env",
  "providers",
  "caches",
] as const;

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

  private factBlocks(): Record<typeof factBlockNames[number], ConfigSchemaNode<unknown | undefined>> {
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
      services: schema.optional(schema.record(identifier(schema), schema.strictObject(
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
      transports: schema.optional(schema.record(identifier(schema), schema.strictObject(
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
      runtimes: schema.optional(schema.record(identifier(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          type: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          ready: schema.optional(booleanCondition(schema)),
          endpoint: schema.optional(stringCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "type", "version", "ready", "endpoint"] },
      ))),
      paths: schema.optional(schema.record(identifier(schema), schema.strictObject(
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
      users: schema.optional(schema.record(identifier(schema), schema.strictObject(
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
      groups: schema.optional(schema.record(identifier(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          gid: schema.optional(numberCondition(schema)),
          members: schema.optional(stringListCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "gid", "members"] },
      ))),
      tools: schema.optional(schema.record(identifier(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          path: schema.optional(stringCondition(schema)),
          version: schema.optional(stringCondition(schema)),
          executable: schema.optional(booleanCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "path", "version", "executable"] },
      ))),
      env: schema.optional(schema.record(identifier(schema), schema.strictObject(
        {
          status: schema.optional(observedStatus(schema)),
          name: schema.optional(stringCondition(schema)),
          value: schema.optional(stringCondition(schema)),
          redacted: schema.optional(booleanCondition(schema)),
          sensitive: schema.optional(booleanCondition(schema)),
        },
        { requireAtLeastOneField: ["status", "name", "value", "redacted", "sensitive"] },
      ))),
      providers: schema.optional(namedObservedMap(schema)),
      caches: schema.optional(schema.unknown()),
    };
  }
}

function namedObservedMap(schema: ConfigSchema): ConfigSchemaNode<Record<string, unknown>> {
  return schema.record(identifier(schema), observedRequirement(schema));
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

function identifier(schema: ConfigSchema): ConfigSchemaNode<string> {
  return schema.string({
    minLength: 1,
    pattern: "^[a-z][a-z0-9._-]*$",
    patternMessage: "must start with a lowercase letter and use lowercase letters, numbers, '.', '_', or '-'",
  });
}
