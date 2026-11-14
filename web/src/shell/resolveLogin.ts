import { auth } from "./session";

/**
 * The one sign-in for every account tier. The server checks the pair against
 * each tier, opens the cookie session and names the cabinet that account
 * belongs to. Resolves to that page, or null when nothing matched or the
 * server could not be reached: offline is not a pass. Never rejects, and
 * keeps nothing: the pair goes to the server once and is gone.
 */
export async function resolveLogin(loginInput: string, passwordInput: string): Promise<string | null> {
  const login = loginInput.trim();
  if (!login && !passwordInput) return null;
  try {
    const session = await auth.login(login, passwordInput);
    /* Only ever a same-site page, never wherever the response points. */
    return auth.safeTarget(session.target);
  } catch {
    return null;
  }
}
