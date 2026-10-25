export const CHECKPOINT_KEY = 'clickpilot.interruption';
export const CHECKPOINT_TTL_MS = 30 * 60 * 1000;
export interface Checkpoint {
  version: 1;
  ownerId: string;
  sessionId: string;
  tabId: number;
  status: 'active' | 'interrupted';
  revision: number;
  expiresAt: number;
}
const token = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,80}$/.test(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isCheckpoint(value: unknown, now = Date.now()): value is Checkpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join() === 'expiresAt,ownerId,revision,sessionId,status,tabId,version'
    && v.version === 1 && token(v.ownerId) && token(v.sessionId) && integer(v.tabId) && integer(v.revision)
    && (v.status === 'active' || v.status === 'interrupted') && integer(v.expiresAt)
    && v.expiresAt > now && v.expiresAt <= now + CHECKPOINT_TTL_MS;
}
export type CheckpointCommand =
  | { type: 'CHECKPOINT_SET'; sessionId: string; tabId: number; revision: number }
  | { type: 'CHECKPOINT_CLEAR'; sessionId: string; revision: number };
export function isCheckpointCommand(value: unknown): value is CheckpointCommand {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return token(v.sessionId) && integer(v.revision)
    && (v.type === 'CHECKPOINT_SET' ? integer(v.tabId) && Object.keys(v).length === 4
      : v.type === 'CHECKPOINT_CLEAR' && Object.keys(v).length === 3);
}
interface Storage {
  read: () => Promise<unknown>;
  write: (value: Checkpoint) => Promise<void>;
  remove: () => Promise<void>;
  tabExists: (tabId: number) => Promise<boolean>;
}
// Only metadata lives here. Ports confer ownership; stored records confer no authority.
export function createCheckpointStore(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve();
  let owner: string | undefined;
  let revision = -1;
  let closed = false;
  let sessionId: string | undefined;
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  }
  async function read() {
    const value = await storage.read();
    if (!isCheckpoint(value) || !await storage.tabExists(value.tabId)) {
      await storage.remove(); return null;
    }
    return value;
  }
  return {
    isOwner: (id: string) => owner === id && !closed,
    notice: () => serial(async () => Boolean(await read())),
    claim(id: string) { owner = id; revision = -1; closed = false; sessionId = undefined; },
    apply(id: string, command: CheckpointCommand) {
      // Reserve revisions synchronously, before any slow write can complete.
      if (owner !== id || closed || command.revision <= revision) return Promise.resolve(false);
      revision = command.revision;
      sessionId = command.sessionId;
      return serial(async () => {
        if (owner !== id || revision !== command.revision) return false;
        if (command.type === 'CHECKPOINT_CLEAR') { await storage.remove(); return true; }
        if (!await storage.tabExists(command.tabId)) return false;
        if (owner !== id || closed || revision !== command.revision) return false;
        await storage.write({ version: 1, ownerId: id, sessionId: command.sessionId, tabId: command.tabId,
          status: 'active', revision: command.revision, expiresAt: Date.now() + CHECKPOINT_TTL_MS });
        return true;
      });
    },
    disconnect(id: string) {
      if (owner !== id) return Promise.resolve();
      closed = true;
      return serial(async () => {
        const value = await read();
        if (value?.ownerId === id) await storage.write({ ...value, status: 'interrupted' });
      });
    },
    removeTab(tabId: number) {
      return serial(async () => {
        const value = await read();
        if (value?.tabId === tabId) {
          if (value.sessionId === sessionId) { closed = true; revision++; }
          await storage.remove();
        }
      });
    },
  };
}
