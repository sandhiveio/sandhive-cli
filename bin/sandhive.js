#!/usr/bin/env node
import { main } from '../src/cli.js';
import { checkForUpdates } from '../src/updates.js';

const args = process.argv.slice(2);
// Check only interactive runs; JSON, previews, pipes, and opted-out runs stay offline.
const updates = process.stdout.isTTY && process.stderr.isTTY && !args.includes('--json') && !args.includes('--dry-run')
  && process.env.SANDHIVE_NO_UPDATE_CHECK !== '1' ? checkForUpdates() : Promise.resolve(null);
process.exitCode = await main(args);
const notice = await updates;
if (notice) process.stderr.write(`${notice}\n`);
