/**
 * TEST DOUBLE for shell/session (setup.ts mocks the real one in every test).
 *
 *   setTestSession({ authenticated: true, role: "company", user: { id: "c1" } })
 *                               the session the page finds; the rest is a guest
 *   resetTestSession()          back to a guest (setup.ts does it after each test)
 *   setLoginResult(session)     what the next auth.login() resolves to; it also
 *                               becomes the current session, as a real sign-in does
 *   setLoginResult(null)        auth.login() is refused (the default)
 *
 *   auth.fetch / auth.json      forward to the stubbed global fetch
 *   auth.login / logout / guest vi.fn, so a test can assert on the calls
 *   useSession()                follows every change above
 */
import { useSyncExternalStore } from "react";
import { vi } from "vitest";

type TestUser = { id?: string; role?: string; login?: string; name?: string; email?: string };

export type TestSession = {
  ok: boolean;
  authenticated: boolean;
  role: string;
  restricted?: boolean;
  target?: string;
  csrfToken: string;
  guest?: { email?: string; name?: string };
  user?: TestUser | null;
};

const GUEST: TestSession = { ok: true, authenticated: false, role: "guest", csrfToken: "test" };
let current: TestSession = GUEST;
let loginResult: TestSession | null = null;
const listeners = new Set<() => void>();

function replaceSession(next: TestSession): TestSession {
  current = next;
  listeners.forEach(listener => listener());
  return current;
}

export function setTestSession(session: Partial<TestSession>): void {
  replaceSession({ ...GUEST, ...session });
}

export function setLoginResult(session: Partial<TestSession> | null): void {
  loginResult = session ? { ...GUEST, authenticated: true, ...session } : null;
}

export function resetTestSession(): void {
  loginResult = null;
  replaceSession(GUEST);
}

function refusal(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

/* auth.js captures fetch when it loads, so tests talk to the stubbed global instead. */
const request = (path: string, options?: RequestInit): Promise<Response> => fetch(path, options);

async function json<T = unknown>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { ...options }
      : { method: "POST", ...options, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const response = await request(path, init);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }
  if (!response.ok) {
    const error = (value as { error?: unknown } | null)?.error;
    throw refusal(typeof error === "string" && error ? error : "Request failed", response.status);
  }
  return value as T;
}

/* The real calls answer after a round trip, so the session never changes
   inside the click that asked for it. */
const roundTrip = (): Promise<void> => Promise.resolve();

export const auth = {
  ready: vi.fn(async () => current),
  current: () => current,
  fetch: request,
  json,
  /* The arguments are only there for tests to assert on. */
  login: vi.fn(async (_login: string, _password: string, _purpose?: string): Promise<TestSession> => {
    await roundTrip();
    if (!loginResult) throw refusal("invalid_credentials", 401);
    return replaceSession(loginResult);
  }),
  logout: vi.fn(async () => {
    await roundTrip();
    return replaceSession(GUEST);
  }),
  guest: vi.fn(async (email: string, name: string) => {
    await roundTrip();
    return replaceSession({ ...current, guest: { email, name } });
  }),
  user: (roles?: readonly string[]): TestUser | null => {
    if (!current.authenticated || current.restricted) return null;
    return !roles || roles.includes(current.role) ? (current.user ?? null) : null;
  },
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

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export const useSession = (): TestSession => useSyncExternalStore(subscribe, () => current);
