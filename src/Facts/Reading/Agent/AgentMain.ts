import type { FactDeclaration } from "../../Domain/FactDeclaration.js";
import { LocalReading } from "../LocalReading.js";

/**
 * openstrap reading the machine it was put on.
 *
 * This is the whole of the agent. It is the entry point of a self-contained
 * executable that openstrap delivers to a target it cannot reach through its own
 * APIs, and it does nothing a caller could not do locally: it reads the machine
 * it is running on and prints the result.
 *
 * Only the reading goes to stdout, because that is what the caller parses.
 * Anything that goes wrong goes to stderr and takes a non-zero exit with it, so a
 * failed reading can never be mistaken for a machine with no facts.
 */
async function main(argv: readonly string[]): Promise<number> {
  try {
    const data = await new LocalReading().read(declarationIn(argv));

    process.stdout.write(JSON.stringify(data));

    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);

    return 1;
  }
}

/**
 * What the caller asked about, handed over as one base64 argument.
 *
 * Encoded so that a declaration containing quotes, spaces or newlines survives
 * whatever shell started this process. An agent invoked with nothing reads
 * everything, which is what "tell me about this machine" means.
 */
function declarationIn(argv: readonly string[]): FactDeclaration {
  const flag = argv.indexOf("--declaration");

  if (flag === -1) {
    return {};
  }

  const encoded = argv[flag + 1];

  if (encoded === undefined) {
    throw new Error("--declaration was given without a value");
  }

  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--declaration must decode to a set of declared sections");
  }

  return parsed as FactDeclaration;
}

// Not `await` at the top level: the agent is bundled to a single CommonJS file,
// which has no way to express one.
void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
