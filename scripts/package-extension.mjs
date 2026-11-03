import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extension = join(root, 'apps/extension');
const { version } = JSON.parse(await readFile(join(extension, 'package.json'), 'utf8'));
const output = join(extension, '.output');
const destination = join(root, 'website/public/downloads/klicko-chromium.zip');

const build = spawnSync('corepack', ['pnpm', '--filter', '@clickpilot/extension', 'exec', 'wxt', 'zip', '-b', 'chrome'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const archives = (await readdir(output)).filter((name) => name.endsWith(`-${version}-chrome.zip`));
if (archives.length !== 1) throw new Error(`Expected one Chrome ZIP for version ${version}; found ${archives.length}.`);

await mkdir(dirname(destination), { recursive: true });
await copyFile(join(output, archives[0]), destination);
console.log(`Website download ready: ${destination}`);
