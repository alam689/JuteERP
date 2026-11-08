/** Storage access that never throws (private mode, blocked storage). */
export function readJson<T>(store: 'local' | 'session', key: string): T | null {
  try {
    const raw = (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(store: 'local' | 'session', key: string, value: unknown): void {
  try {
    (store === 'local' ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeKey(store: 'local' | 'session', key: string): void {
  try {
    (store === 'local' ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* ignore */
  }
}
