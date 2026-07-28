#!/usr/bin/env node
import { main } from "./Main.js";

process.exitCode = await main(process.argv);
