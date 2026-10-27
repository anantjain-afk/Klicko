export interface RobotFrameState {
  type: 'DRAW_ROBOT';
  expression: number;
  lookX: number;
  lookY: number;
  still: boolean;
  active: boolean;
}
export const expressionNames = ['Idle', 'Listening', 'Thinking', 'Happy', 'Confused', 'Surprised', 'Sleepy', 'Error', 'Still'];

// The private graphics channel carries only bounded animation values, never task commands or text.
export function isRobotFrameState(value: unknown): value is RobotFrameState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join() === 'active,expression,lookX,lookY,still,type' && v.type === 'DRAW_ROBOT'
    && typeof v.expression === 'number' && Number.isInteger(v.expression) && v.expression >= 0 && v.expression <= 7
    && typeof v.lookX === 'number' && Number.isFinite(v.lookX) && Math.abs(v.lookX) <= 8
    && typeof v.lookY === 'number' && Number.isFinite(v.lookY) && Math.abs(v.lookY) <= 7
    && typeof v.still === 'boolean' && typeof v.active === 'boolean';
}
