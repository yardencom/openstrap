import { configSchema } from "../../ConfigCore/index.js";
import { ArtifactCapture } from "../Domain/ValueObjects/ArtifactCapture.js";
import { FileRequirement } from "../Domain/ValueObjects/FileRequirement.js";
import { SessionKind } from "../Domain/ValueObjects/SessionKind.js";
import { FactSettingsSchema } from "./FactSettingsSchema.js";
import { FactsConfigPrimitives } from "./FactsConfigPrimitives.js";

export class FactSectionSchemas {
  static command() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      name: FactsConfigPrimitives.nonEmptyString(),
      args: configSchema.optional(configSchema.array(configSchema.string())),
    });
  }

  static env() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      names: configSchema.array(FactsConfigPrimitives.nonEmptyString(), { nonempty: true }),
    });
  }

  static file() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      path: FactsConfigPrimitives.nonEmptyString(),
      require: configSchema.optional(
        configSchema.array(configSchema.enum(FileRequirement), { nonempty: true }),
      ),
    });
  }

  static process() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      name: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
      command: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
      pidFile: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
    });
  }

  static package() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      names: configSchema.array(FactsConfigPrimitives.nonEmptyString(), { nonempty: true }),
      manager: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
    });
  }

  static user() {
    return configSchema.union([
      configSchema.strictObject({
        ...FactSettingsSchema.properties(),
        name: FactsConfigPrimitives.nonEmptyString(),
      }),
      configSchema.strictObject({
        ...FactSettingsSchema.properties(),
        uid: configSchema.union([
          FactsConfigPrimitives.nonnegativeInteger(),
          FactsConfigPrimitives.nonEmptyString(),
        ]),
      }),
    ]);
  }

  static group() {
    return configSchema.union([
      configSchema.strictObject({
        ...FactSettingsSchema.properties(),
        name: FactsConfigPrimitives.nonEmptyString(),
      }),
      configSchema.strictObject({
        ...FactSettingsSchema.properties(),
        gid: configSchema.union([
          FactsConfigPrimitives.nonnegativeInteger(),
          FactsConfigPrimitives.nonEmptyString(),
        ]),
      }),
    ]);
  }

  static service() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      name: FactsConfigPrimitives.nonEmptyString(),
      manager: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
    });
  }

  static session() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      kind: configSchema.optional(configSchema.enum(SessionKind)),
      owner: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
    });
  }

  static artifact() {
    return configSchema.strictObject({
      ...FactSettingsSchema.properties(),
      path: FactsConfigPrimitives.nonEmptyString(),
      kind: configSchema.optional(FactsConfigPrimitives.nonEmptyString()),
      capture: configSchema.defaulted(configSchema.enum(ArtifactCapture), ArtifactCapture.Metadata),
    });
  }
}
