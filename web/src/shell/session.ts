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
  user?: { id?: string; name?: string; email?: string } | null;
};

type AuthApi = {
  ready: (refresh?: boolean) => Promise<Session>;
  current: () => Session | null;
  fetch: (path: string, options?: RequestInit) => Promise<Response>;
  logout: () => Promise<Session>;
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
