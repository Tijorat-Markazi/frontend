import { useEffect, useSyncExternalStore } from "react";
import "@legacy/auth.js";

export type Session = {
  ok: boolean;
  authenticated: boolean;
  role: string;
  restricted?: boolean;
  target?: string;
  csrfToken: string;
  guest?: { email?: string; name?: string };
  user?: SessionUser | null;
};

/** The signed-in account as the server describes it. Never a credential. */
export type SessionUser = { id?: string; role?: string; login?: string; name?: string; email?: string };

export type AuthApi = {
  ready: (refresh?: boolean) => Promise<Session>;
  current: () => Session | null;
  fetch: (path: string, options?: RequestInit) => Promise<Response>;
  /** Reads JSON and rejects with the server's error (and its `status`) when refused. A body makes it a POST. */
  json: <T = unknown>(path: string, body?: unknown, options?: RequestInit) => Promise<T>;
  /** Rejects when the pair is refused. "rights" opens a session limited to the personal-data page. */
  login: (login: string, password: string, purpose?: string) => Promise<Session>;
  logout: () => Promise<Session>;
  /** The account behind a full (not restricted) session, when its role is one of `roles`. */
  user: (roles?: readonly string[]) => SessionUser | null;
  guest: (email: string, name: string) => Promise<Session>;
  safeTarget: (target?: string) => string | null;
  safeUrl: (value?: string, allowImageData?: boolean) => string;
};

/**
 * The same-origin cookie session from auth.js. It sends the CSRF header on
 * writes and creates one guest cookie before parallel reads can race.
 */
export const auth = (window as unknown as { KGAuth: AuthApi }).KGAuth;

function subscribe(onChange: () => void): () => void {
  window.addEventListener("kg:session", onChange);
  window.addEventListener("kg:expired", onChange);
  return () => {
    window.removeEventListener("kg:session", onChange);
    window.removeEventListener("kg:expired", onChange);
  };
}

/** The current server session, or null until it has loaded. */
export function useSession(): Session | null {
  const session = useSyncExternalStore(subscribe, auth.current);

  useEffect(() => {
    /* A backend outage reads as signed out; API calls report their own errors. */
    auth.ready().catch(() => undefined);
  }, []);

  return session;
}
