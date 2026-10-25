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
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  }
  const keyFor = (tabId: number) => `clickpilot.activation.${tabId}`;
  return {
    activate: (tabId: number, url: string) => serial(async () => {
      const origin = originOf(url);
      if (origin) await storage.write(keyFor(tabId), origin);
    }),
    navigation: (tabId: number, url: string) => serial(async () => {
      const key = keyFor(tabId);
      if (await storage.read(key) !== originOf(url)) await storage.remove(key);
    }),
    remove: (tabId: number) => serial(() => storage.remove(keyFor(tabId))),
    allows: (tabId: number, url: string) => serial(async () => {
      const origin = originOf(url);
      if (!origin || await storage.read(keyFor(tabId)) !== origin) return false;
      try { await storage.probe(tabId); return true; }
      catch { await storage.remove(keyFor(tabId)); return false; }
    }).catch(() => false),
  };
}
