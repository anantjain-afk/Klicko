import { createRoot } from 'react-dom/client';
import { FramedRobot } from './FramedRobot';
import type { RobotProps } from './robot-types';

// Keeps the existing native DOM buddy/controller intact; React owns only its artwork.
export function mountRobot(element: HTMLElement) {
  const root = createRoot(element);
  return {
    update(props: RobotProps) { root.render(<FramedRobot {...props} />); },
    dispose() { root.unmount(); },
  };
}
