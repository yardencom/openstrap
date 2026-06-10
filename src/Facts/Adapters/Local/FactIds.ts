export function stableFactId(prefix: string, targetName: string, timestamp: string): string {
  return `${prefix}_${targetName}_${timestamp.replace(/[^0-9A-Za-z]/g, "")}`;
}
