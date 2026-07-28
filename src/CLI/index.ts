#!/usr/bin/env node
import { main } from "./Main.js";

// Not `await` at the top level: openstrap is bundled to a single CommonJS file for the machines it
// delivers itself to, and CommonJS has no way to express one.
void main(process.argv).then((code) => {
  process.exitCode = code;
});
