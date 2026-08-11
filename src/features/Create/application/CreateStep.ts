/** One thing creating a machine did, as a person would read it back. */
export type CreateStep = {
  name: string;
  status: "succeeded" | "skipped";
  detail?: string;
  /** When the step finished. */
  finishedAt: string;
};
