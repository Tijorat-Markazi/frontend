import { vi } from "vitest";

type TestSession = {
  ok: boolean;
  authenticated: boolean;
  role: string;
  restricted?: boolean;
  target?: string;
  csrfToken: string;
  guest?: { email?: string; name?: string };
  user?: { id?: string; name?: string; email?: string } | null;
};

const GUEST: TestSession = { ok: true, authenticated: false, role: "guest", csrfToken: "test" };
let current: TestSession = GUEST;

export function setTestSession(session: Partial<TestSession>): void {
  current = { ...GUEST, ...session };
}

export function resetTestSession(): void {
  current = GUEST;
}

/* auth.js captures fetch when it loads, so tests talk to the stubbed global instead. */
export const auth = {
  ready: vi.fn(async () => current),
  current: () => current,
  fetch: (path: string, options?: RequestInit) => fetch(path, options),
  logout: vi.fn(async () => GUEST),
  guest: vi.fn(async (email: string, name: string) => {
    current = { ...current, guest: { email, name } };
    return current;
  }),
  safeTarget: (target?: string) => (/^[a-z0-9._-]+\.html$/i.test(target ?? "") ? (target as string) : null),
  safeUrl: (value?: string, allowImageData?: boolean): string => {
    if (!String(value ?? "").trim()) return "";
    try {
      const url = new URL(String(value), window.location.href);
      if (url.origin === window.location.origin && /^https?:$/.test(url.protocol)) return url.pathname + url.search + url.hash;
      if (/^https?:$/.test(url.protocol)) return url.href;
      if (allowImageData && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(String(value))) return String(value);
    } catch {
      return "";
    }
    return "";
  },
};

export const useSession = (): TestSession => current;
