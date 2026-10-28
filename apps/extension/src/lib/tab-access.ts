interface AccessStorage {
  read: (key: string) => Promise<unknown>;
  write: (key: string, origin: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  probe: (tabId: number) => Promise<void>;
}

function originOf(url: string): string | null {
  try { const urlObject = new URL(url); return /^https?:$/.test(urlObject.protocol) ? urlObject.origin : null; }
  catch { return null; }
}

// A toolbar activation survives worker sleep, but never substitutes for Chrome access.
// Store only tab/origin metadata in trusted session storage, separately from tasks.
export function createTabAccess(storage: AccessStorage) {
  const queues = new Map<number, Promise<unknown>>();
  function serial<T>(tabId: number, work: () => Promise<T>): Promise<T> {
    const result = (queues.get(tabId) ?? Promise.resolve()).then(work);
    const settled = result.catch(() => undefined);
    queues.set(tabId, settled);
    void settled.then(() => { if (queues.get(tabId) === settled) queues.delete(tabId); });
    return result;
  }
  const keyFor = (tabId: number) => `clickpilot.activation.${tabId}`;
  return {
    activate: (tabId: number, url: string) => serial(tabId, async () => {
      const origin = originOf(url);
      if (origin) await storage.write(keyFor(tabId), origin);
    }),
    navigation: (tabId: number, url: string) => serial(tabId, async () => {
      const key = keyFor(tabId);
      if (await storage.read(key) !== originOf(url)) await storage.remove(key);
    }),
    remove: (tabId: number) => serial(tabId, () => storage.remove(keyFor(tabId))),
    allows: (tabId: number, url: string) => serial(tabId, async () => {
      const origin = originOf(url);
      if (!origin || await storage.read(keyFor(tabId)) !== origin) return false;
      try { await storage.probe(tabId); return true; }
      catch { await storage.remove(keyFor(tabId)); return false; }
    }).catch(() => false),
  };
}
