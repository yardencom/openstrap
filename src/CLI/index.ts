#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
/*
 * The flag silences one warning nobody running openstrap can act on: `node:sqlite` is marked
 * experimental in Node 24 and says so on every command. Depending on it was decided with that in
 * mind (ADR 0005) — the alternative is a native module, which does not survive being packaged into
 * one executable (ADR 0001).
 *
 * It is a flag rather than code because no code can be early enough: the warning is printed as the
 * module is loaded, before the first statement of the first module body runs. Wrapping
 * `process.emitWarning` and replacing the `warning` listener were both tried and both are too late.
 */
import { Cli } from "./Main.js";

// Not `await` at the top level: openstrap is bundled to a single CommonJS file for the machines it
// delivers itself to, and CommonJS has no way to express one.
void Cli.main(process.argv).then((code) => {
  process.exitCode = code;
});
