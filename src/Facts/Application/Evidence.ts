export type CommandEvidence = {
  status: "success" | "error" | "skipped";
  command: string;
  args: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  reason?: string;
};

export type ArtifactEvidence = {
  status: "present" | "absent" | "error";
  path: string;
  kind?: string;
  type?: string;
  sizeBytes?: number;
  reason?: string;
};

export type CollectionEvidence = {
  commands: Record<string, CommandEvidence>;
  artifacts: Record<string, ArtifactEvidence>;
};

export function hasEvidenceError(evidence: CollectionEvidence): boolean {
  return Object.values(evidence.commands).some((item) => item.status === "error") ||
    Object.values(evidence.artifacts).some((item) => item.status === "error");
}
