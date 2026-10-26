#!/usr/bin/env node
import { main } from '../src/cli.js';
import { checkForUpdates, shouldCheckForUpdates } from '../src/updates.js';

const args = process.argv.slice(2);
// Local setup and previews must not make background network requests.
process.exitCode = await main(args);
const notice = process.exitCode === 0 && shouldCheckForUpdates(args, { stdoutIsTTY: process.stdout.isTTY,
  stderrIsTTY: process.stderr.isTTY, disabled: process.env.SANDHIVE_NO_UPDATE_CHECK })
  ? await checkForUpdates() : null;
if (notice) process.stderr.write(`${notice}\n`);
