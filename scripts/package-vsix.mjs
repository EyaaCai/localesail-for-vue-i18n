import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const outFile = resolve(rootDir, 'release', `${pkg.name}-${pkg.version}.vsix`);

mkdirSync(dirname(outFile), { recursive: true });

const result = spawnSync(
  'npx',
  ['--yes', '@vscode/vsce', 'package', '--out', outFile],
  {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: 'inherit'
  }
);

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
