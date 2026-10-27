import type { CompanionMood } from './companion';

export interface RobotProps {
  mood: CompanionMood;
  visible?: boolean;
  typingTarget?: HTMLTextAreaElement | null;
  clickSignal?: number;
  floating?: boolean;
  dragging?: boolean;
  guideTarget?: () => DOMRect | null;
  className?: string;
}
