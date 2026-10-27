import { expect, it } from 'vitest';
import { isRobotFrameState } from '../../src/features/buddy/robot-frame';

const pose = { type: 'DRAW_ROBOT', expression: 3, lookX: 8, lookY: -7, still: false, active: true };

it('accepts bounded graphics values and rejects non-finite or unsupported poses', () => {
  expect(isRobotFrameState(pose)).toBe(true);
  for (const change of [{ expression: -1 }, { expression: 8 }, { expression: 1.5 }, { lookX: NaN },
    { lookY: Infinity }, { lookX: -9 }, { lookY: 8 }, { active: 'true' }, { still: null }]) {
    expect(isRobotFrameState({ ...pose, ...change })).toBe(false);
  }
});

it('does not accept task commands, text or extra fields on the graphics channel', () => {
  for (const value of [null, [], { type: 'TASK_COMMAND', action: 'start', goal: 'hello' },
    { ...pose, goal: 'hello' }, { ...pose, selectedText: 'hello' }]) {
    expect(isRobotFrameState(value)).toBe(false);
  }
});
