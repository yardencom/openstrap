import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type JsonFileExportRequest<TPayload> = {
  resultPath: string;
  payload: TPayload;
};

export type JsonFileExportResult = {
  resultPath: string;
};

export class JsonFileExporter {
  write<TPayload>(request: JsonFileExportRequest<TPayload>): JsonFileExportResult {
    mkdirSync(dirname(request.resultPath), { recursive: true });
    writeFileSync(request.resultPath, `${JSON.stringify(request.payload, null, 2)}\n`, "utf8");

    return {
      resultPath: request.resultPath,
    };
  }
}
