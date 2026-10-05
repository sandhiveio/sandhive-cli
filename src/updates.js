import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const BETA_NOTICE = 'SandHive CLI is in beta and active development. Update your checkout before use: git pull --ff-only (from the sandhive-cli directory).';
const exec = promisify(execFile);
const installation = fileURLToPath(new URL('../', import.meta.url));

export async function checkForUpdates({ fetchImpl = globalThis.fetch, gitImpl = exec } = {}) {
  try {
    const { stdout } = await gitImpl('git', ['-c', `safe.directory=${installation}`, 'rev-parse', '--show-toplevel', 'HEAD'],
      { cwd: installation, timeout: 2000, windowsHide: true });
    const [root, commit] = stdout.trim().split(/\r?\n/);
    if (resolve(root) !== resolve(installation) || !/^[a-f0-9]{40}$/.test(commit)) return null;
    const response = await fetchImpl(`https://api.github.com/repos/sandhiveio/sandhive-cli/compare/${commit}...main`, {
      headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(2000), redirect: 'error',
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.status === 'ahead' || result.status === 'diverged') {
      return 'A newer SandHive CLI commit is available on main. Update your checkout before use: git pull --ff-only. If branches have diverged, review your local changes first.';
    }
  } catch { /* Update checks are best effort and never fail a command. */ }
  return null;
}
