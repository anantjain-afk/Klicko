import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';

const require = createRequire(import.meta.url);
const output = new URL('../public/buddy/', import.meta.url);
mkdirSync(output, { recursive: true });
copyFileSync(new URL('../../../prototypes/robot-playground/public/robot.riv', import.meta.url), new URL('robot.riv', output));
copyFileSync(require.resolve('@rive-app/canvas/rive.wasm'), new URL('rive.wasm', output));

const soundOutput = new URL('../public/sounds/', import.meta.url);
mkdirSync(soundOutput, { recursive: true });
for (const name of ['agent-launch', 'agent-close', 'clicky-text-open', 'clicky-text-close',
  'clicky-text-send', 'clicky-text-selection', 'sidebar', 'boing-1', 'boing-2']) {
  copyFileSync(new URL(`../../../sounds/${name}.wav`, import.meta.url), new URL(`${name}.wav`, soundOutput));
}
