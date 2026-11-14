/**
 * CABINET LOGIN — the sign-in life cycle every cabinet page shares.
 *
 *   const { state, submit, signOut } = useCabinetLogin({
 *     role: "assoc",                       // or several: ["admin", "rais"]
 *     ownPage: "association.html",         // where this cabinet lives
 *     signIn: () => loadAccount(),         // the tier's own call, e.g.
 *                                          // POST /api/assoc/login {}; null = refused
 *   });
 *
 *   state.status  "checking"   the server is being asked who is signed in
 *                 "signedOut"  show the login form
 *                 "signedIn"   state.account is set
 *   submit(login, password)    signs in through the one cross-role sign-in. An
 *                              account of this cabinet is loaded with signIn();
 *                              someone who typed another tier's pair is sent to
 *                              THEIR cabinet. Resolves to false only when the
 *                              form should say "wrong login or password".
 *   signOut()                  ends the server session and shows the form; where
 *                              to go next is the page's own business. When the
 *                              server cannot be reached the cabinet stays open
 *                              and a dialog says why.
 *
 * The session lives in an HttpOnly cookie, so nothing here stores or returns a
 * credential. A restricted session (opened for the personal-data page only)
 * and a session of another role both show the form.
 * `signIn` may reject on a network failure; that counts as a refusal.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { dialogs } from "../dialogs";
import { goTo } from "../navigate";
import { resolveLogin } from "../resolveLogin";
import { auth } from "../session";

export type CabinetLoginState<Account> =
  | { status: "checking" }
  | { status: "signedOut" }
  | { status: "signedIn"; account: Account };

export type CabinetLoginOptions<Account> = {
  role: string | readonly string[];
  ownPage: string;
  signIn: () => Promise<Account | null>;
};

export type CabinetLogin<Account> = {
  state: CabinetLoginState<Account>;
  submit: (login: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

async function holdsRole(roles: readonly string[]): Promise<boolean> {
  try {
    const session = await auth.ready();
    return session.authenticated && !session.restricted && roles.includes(session.role);
  } catch {
    /* No session service: the form is shown, and signing in reports the outage. */
    return false;
  }
}

export function useCabinetLogin<Account>(options: CabinetLoginOptions<Account>): CabinetLogin<Account> {
  const { role, ownPage } = options;
  /* A string, so an inline array of roles does not restart the check on every render. */
  const roleKey = typeof role === "string" ? role : role.join("|");
  const [state, setState] = useState<CabinetLoginState<Account>>({ status: "checking" });
  const latestSignIn = useRef(options.signIn);
  latestSignIn.current = options.signIn;

  const loadAccount = useCallback((): Promise<Account | null> => latestSignIn.current().catch(() => null), []);

  useEffect(() => {
    let isCurrent = true;
    void (async () => {
      const account = (await holdsRole(roleKey.split("|"))) ? await loadAccount() : null;
      if (!isCurrent) return;
      setState(account === null ? { status: "signedOut" } : { status: "signedIn", account });
    })();
    return () => {
      isCurrent = false;
    };
  }, [roleKey, loadAccount]);

  const submit = useCallback(
    async (loginInput: string, password: string): Promise<boolean> => {
      const target = await resolveLogin(loginInput, password);
      if (!target) return false;
      if (target !== ownPage) {
        /* Another tier's account: the session is theirs now, so is the cabinet. */
        goTo(target);
        return true;
      }
      const account = await loadAccount();
      if (account === null) return false;
      setState({ status: "signedIn", account });
      return true;
    },
    [ownPage, loadAccount],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await auth.logout();
      setState({ status: "signedOut" });
    } catch (error: unknown) {
      void dialogs.alert(error instanceof Error ? error.message : String(error));
    }
  }, []);

  return { state, submit, signOut };
}
