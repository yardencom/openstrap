import type { ConfigLoadRequest, JsonSchema } from "../ConfigCore/index.js";
import type { OpenStrapBlueprint } from "./Domain/Blueprint.js";
import { BlueprintDocumentReader } from "./Application/BlueprintDocumentReader.js";
import { BlueprintTransformer } from "./Application/BlueprintTransformer.js";
import { BlueprintValidator } from "./Application/BlueprintValidator.js";

export class Blueprints {
  constructor(
    private readonly reader = new BlueprintDocumentReader(),
    private readonly transformer = new BlueprintTransformer(),
    private readonly validator = new BlueprintValidator(),
  ) {}

  parseYaml(yamlText: string): Readonly<OpenStrapBlueprint> {
    return this.load({
      mode: "inline",
      content: yamlText,
    });
  }

  load(request: ConfigLoadRequest): Readonly<OpenStrapBlueprint> {
    const document = this.reader.read(request);
    const blueprint = this.transformer.transform(document);
    this.validator.assertValid(blueprint);

    return blueprint;
  }

  getJsonSchema(): Readonly<JsonSchema> {
    return this.reader.getJsonSchema();
  }
}

export { Blueprints as BlueprintConfig };
