export type FactInput =
  | {
      type: "string";
      required?: boolean;
      default?: string;
    }
  | {
      type: "path";
      required?: boolean;
      default?: string;
    }
  | {
      type: "number";
      required?: boolean;
      default?: number;
    }
  | {
      type: "boolean";
      required?: boolean;
      default?: boolean;
    }
  | {
      type: "enum";
      required?: boolean;
      values: string[];
      default?: string;
    }
  | {
      type: "array";
      required?: boolean;
      default?: unknown[];
    };
