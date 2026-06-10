#!/usr/bin/env node
import { main } from "./Application/Main.js";

process.exitCode = await main(process.argv);
