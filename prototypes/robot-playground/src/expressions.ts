export const expressions = ['Idle', 'Listening', 'Thinking', 'Happy', 'Confused', 'Surprised', 'Sleepy', 'Error'] as const;
export type Expression = typeof expressions[number];
export type ExpressionPreview = 'Automatic' | Expression;

export const expressionDescriptions: Record<Expression, string> = {
  Idle: 'A quiet breath, a head lean, an occasional blink.',
  Listening: 'Leaning in and watching the writing area with curiosity.',
  Thinking: 'Looking upward, searching from one side to the other.',
  Happy: 'A little anticipation, a delighted lift, then smiling eyes.',
  Confused: 'One eye narrows as the head tips to the side.',
  Surprised: 'Wide eyes and a quick, playful recoil.',
  Sleepy: 'Heavy lids, a slow blink and almost no movement.',
  Error: 'A brief concerned reaction, then a calm recovery.',
};
