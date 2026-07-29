import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { kill as signalProcess } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import which from "which";

import type {
  CapturedSystemCommand,
  DetachedProcessCommand,
  ProcessAPI,
  ProcessOutput,
  SystemCommand,
} from "../../types/Process.js";

export class LocalProcesses implements ProcessAPI {
  async capture(command: CapturedSystemCommand): Promise<ProcessOutput> {
    const environment = this.environment(command.environment);
    const executable = await this.resolveExecutable(command.command, environment);

    return new Promise<ProcessOutput>((resolve) => {
      const child = spawn(executable, command.args, {
        cwd: command.cwd,
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.once("error", (error) => {
        resolve({
          exitCode: null,
          stdout,
          stderr: `${stderr}${error.message}`,
        });
      });
      child.once("exit", (exitCode) => {
        resolve({
          exitCode,
          stdout,
          stderr,
        });
      });
    });
  }

  async processRunning(pid: number): Promise<boolean> {
    try {
      signalProcess(pid, 0);

      if (process.platform === "linux") {
        const processStat = readFileSync(`/proc/${pid}/stat`, "utf8");
        const state = processStat.slice(processStat.lastIndexOf(")") + 2, processStat.lastIndexOf(")") + 3);

        if (state === "Z") {
          return false;
        }
      }

      return true;
    } catch (error) {
      return errorCode(error) === "EPERM";
    }
  }

  async run(command: SystemCommand): Promise<void> {
    const environment = this.environment(command.environment);
    const executable = await this.resolveExecutable(command.command, environment);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, command.args, {
        cwd: command.cwd,
        env: environment,
        stdio: command.stdio,
      });

      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Command failed: ${[command.command, ...command.args].join(" ")}`));
      });
    });
  }

  async startDetachedProcess(command: DetachedProcessCommand): Promise<number> {
    await mkdir(dirname(command.stdoutLog), { recursive: true });
    const environment = this.environment(command.environment);
    const executable = await this.resolveExecutable(command.command, environment);

    const stdout = openSync(command.stdoutLog, "a");
    const stderr = openSync(command.stderrLog, "a");

    try {
      const child = spawn(executable, command.args, {
        cwd: command.cwd,
        detached: true,
        env: environment,
        stdio: ["ignore", stdout, stderr],
      });

      if (!child.pid) {
        throw new Error(`Failed to start process: ${command.command}`);
      }

      child.unref();

      return child.pid;
    } finally {
      closeSync(stdout);
      closeSync(stderr);
    }
  }

  async stopDetachedProcess(pid: number, timeoutMs: number): Promise<void> {
    this.signalProcessGroup(pid, "SIGTERM");

    const deadline = Date.now() + timeoutMs;

    while ((await this.processRunning(pid)) && Date.now() < deadline) {
      await delay(25);
    }

    if (await this.processRunning(pid)) {
      this.signalProcessGroup(pid, "SIGKILL");
    }
  }

  async succeeds(command: SystemCommand): Promise<boolean> {
    const environment = this.environment(command.environment);
    const executable = await this.resolveExecutable(command.command, environment);

    return new Promise<boolean>((resolve) => {
      const child = spawn(executable, command.args, {
        cwd: command.cwd,
        env: environment,
        stdio: command.stdio,
      });

      child.once("error", () => resolve(false));
      child.once("exit", (code) => resolve(code === 0));
    });
  }

  private async resolveExecutable(command: string, environment: NodeJS.ProcessEnv): Promise<string> {
    return (await which(command, { nothrow: true, path: environment.PATH })) ?? command;
  }

  private signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
    try {
      signalProcess(process.platform === "win32" ? pid : -pid, signal);
    } catch (error) {
      if (errorCode(error) !== "ESRCH") {
        throw error;
      }
    }
  }

  private environment(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
    const environment = { ...process.env };

    for (const [name, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete environment[name];
      } else {
        environment[name] = value;
      }
    }

    return environment;
  }
}

function errorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}
