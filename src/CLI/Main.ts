import { CliArgsParser, type ParsedArgs } from "./Arguments/index.js";
import { renderCreateOutput } from "./Output/CreateOutput.js";
import { renderFactsOutput } from "./Output/FactsOutput.js";
import { renderRunOutput } from "./Output/RunOutput.js";
import { createCliRuntime } from "./CliRuntime.js";
import { connectToTarget } from "./application/ConnectArgs.js";
import { createTarget } from "./application/CreateArgs.js";
import { CliErrors } from "./Errors.js";
import { collectHostFacts } from "./application/FactsCollectArgs.js";
import { runOpenStrapFlow } from "./application/RunArgs.js";

export type CliIo = {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  cwd: string;
};

/**
 * The command line: read the arguments, run the command they name, report.
 *
 * Nothing here decides what a command does or how its result reads — those live with
 * the command and with its output. What is decided here is the shape every command
 * shares: bad arguments print the usage and exit 2, a thrown error prints and exits 2,
 * and `--json` prints the result verbatim instead of the rendered form, so anything
 * openstrap can say a person can also parse.
 *
 * A switch over the discriminated command rather than a chain of conditions: with no
 * fall-through, a command that is added and not handled here is a compile error. It
 * used to fall into `run`.
 */
export async function main(argv: readonly string[], io: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
}): Promise<number> {
  const errors = new CliErrors();
  let parsedArgs: ParsedArgs;

  try {
    parsedArgs = new CliArgsParser().parse(argv);
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n\n${errors.usage()}\n`);

    return 2;
  }

  try {
    switch (parsedArgs.command) {
      case "run": {
        const run = await runOpenStrapFlow({
          configPath: parsedArgs.configPath,
          workspaceRoot: io.cwd,
        });

        io.stdout.write(printed(parsedArgs.json, run, () => renderRunOutput(run)));

        return exitCodeFor(run.requirementRun.status);
      }

      case "facts.collect": {
        const collected = await collectHostFacts({ workspaceRoot: io.cwd });

        io.stdout.write(printed(parsedArgs.json, collected, () => renderFactsOutput(collected)));

        return collected.facts.some((item) => item.run.status === "error") ? 1 : 0;
      }

      case "create": {
        const created = await createTarget({
          target: parsedArgs.target,
          configPath: parsedArgs.configPath,
          hostPort: parsedArgs.hostPort,
          runtime: await createCliRuntime(parsedArgs, io.cwd),
          workspaceRoot: io.cwd,
        });

        io.stdout.write(printed(parsedArgs.json, created, () => renderCreateOutput(parsedArgs.target, created)));

        return exitCodeFor(created.requirementRun?.status);
      }

      case "connect": {
        const connected = await connectToTarget({
          target: parsedArgs.target,
          command: parsedArgs.run,
          runtime: await createCliRuntime(parsedArgs, io.cwd),
        });

        io.stdout.write(connected.output);

        return connected.exitCode;
      }
    }
  } catch (error) {
    io.stderr.write(`${errors.format(error)}\n`);

    return 2;
  }
}

function printed(asJson: boolean, result: unknown, render: () => string): string {
  return asJson ? `${JSON.stringify(result, null, 2)}\n` : render();
}

/**
 * A run that passed, or had nothing to check, leaves openstrap successful.
 *
 * Anything else is a failure the caller has to be able to notice from a script, which
 * is why it is an exit code and not only a line of output.
 */
function exitCodeFor(status: string | undefined): number {
  return status === undefined || status === "passed" || status === "skipped" ? 0 : 1;
}
