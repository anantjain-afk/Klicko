import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = process.env.RIVE_CLI || resolve(homedir(), '.rive/bin/rive');
const character = resolve(root, 'character');
execFileSync(cli, [character, '--verify'], { stdio: 'inherit' });
const report = JSON.parse(execFileSync(cli, ['inspect', character, '--summary'], { encoding: 'utf8' }));
if (report.problems.length) throw new Error(JSON.stringify(report.problems, null, 2));
execFileSync(cli, [character, '--once'], { stdio: 'inherit' });
mkdirSync(resolve(root, 'public'), { recursive: true });
copyFileSync(resolve(character, 'build/clickpilot-buddy.riv'), resolve(root, 'public/robot.riv'));
console.log('Validated and copied the character to public/robot.riv.');
