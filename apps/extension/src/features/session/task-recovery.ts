import { TaskContextSchema, type TaskContext } from '@clickpilot/shared/guidance';
import { containsSensitiveText } from '@clickpilot/shared/privacy';

export const TASK_TTL_MS = 30 * 60 * 1000;
export const taskKey = (tabId: number) => `clickpilot.task.${tabId}`;
export interface TaskRecovery {
  version: 1;
  tabId: number;
  sessionId: string;
  requestId: number;
  goal: string;
  context: TaskContext;
  status: string;
  expiresAt: number;
  summary?: string;
}
const statuses = ['idle', 'navigating', 'connection_paused', 'observing', 'selecting', 'highlighting', 'waiting',
  'verifying', 'recovery', 'confirmed', 'answer', 'clicked', 'clarification', 'unsupported', 'paused', 'error', 'stopped'];
export function isTaskRecovery(value: unknown, tabId: number, now = Date.now()): value is TaskRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !['version', 'tabId', 'sessionId', 'requestId', 'goal', 'context', 'status', 'expiresAt', 'summary'].includes(key))) return false;
  const context = TaskContextSchema.safeParse(v.context);
  return v.version === 1 && v.tabId === tabId && Number.isSafeInteger(tabId) && tabId >= 0
    && typeof v.sessionId === 'string' && /^[a-f\d-]{36}$/i.test(v.sessionId)
    && typeof v.requestId === 'number' && Number.isSafeInteger(v.requestId) && v.requestId >= 0
    && typeof v.goal === 'string' && v.goal.trim().length > 0 && v.goal.length <= 240 && !containsSensitiveText(v.goal)
    && context.success && !containsSensitiveText(context.data.previousStep?.action ?? '')
    && typeof v.status === 'string' && statuses.includes(v.status)
    && typeof v.expiresAt === 'number' && Number.isSafeInteger(v.expiresAt) && v.expiresAt > now && v.expiresAt <= now + TASK_TTL_MS
    && (v.summary === undefined || (typeof v.summary === 'string' && v.summary.length <= 280 && !containsSensitiveText(v.summary)))
    && new TextEncoder().encode(JSON.stringify(v)).byteLength <= 4096;
}

interface Storage {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: TaskRecovery) => Promise<void>;
  remove: (key: string) => Promise<void>;
}
// All mutations share the queue, including tab closure and delayed old writes.
export function createTaskRecoveryStore(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve();
  const revisions = new Map<number, number>();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work); queue = result.catch(() => undefined); return result;
  }
  return {
    read: (tabId: number) => serial(async () => {
      const value = await storage.read(taskKey(tabId));
      if (value === undefined) return null;
      if (isTaskRecovery(value, tabId)) return value;
      await storage.remove(taskKey(tabId)); return null;
    }),
    save(tabId: number, value: TaskRecovery | null) {
      const revision = (revisions.get(tabId) ?? 0) + 1;
      revisions.set(tabId, revision);
      return serial(async () => {
        if (revisions.get(tabId) !== revision) return;
        if (!value) { await storage.remove(taskKey(tabId)); return; }
        if (!isTaskRecovery(value, tabId)) throw new Error('This task cannot be saved safely. Use a public question.');
        await storage.write(taskKey(tabId), value);
      });
    },
  };
}
