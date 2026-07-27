export type SystemCommand = {
  command: string;
  args: string[];
  cwd: string;
  environment?: Record<string, string | undefined>;
  stdio: "ignore" | "inherit";
};

export type CapturedSystemCommand = Omit<SystemCommand, "stdio">;

export type DetachedProcessCommand = {
  command: string;
  args: string[];
  cwd: string;
  environment?: Record<string, string | undefined>;
  stdoutLog: string;
  stderrLog: string;
};

export type ProcessOutput = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export interface ProcessAPI {
  capture(command: CapturedSystemCommand): Promise<ProcessOutput>;
  processRunning(pid: number): Promise<boolean>;
  run(command: SystemCommand): Promise<void>;
  startDetachedProcess(command: DetachedProcessCommand): Promise<number>;
  stopDetachedProcess(pid: number, timeoutMs: number): Promise<void>;
  succeeds(command: SystemCommand): Promise<boolean>;
}
