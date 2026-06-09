import type { RedactionStrategy } from "./RedactionStrategy.js";

export type Redaction =
  | RedactionStrategy
  | {
      strategy: RedactionStrategy;
      fields?: string[];
      patterns?: string[];
    };
