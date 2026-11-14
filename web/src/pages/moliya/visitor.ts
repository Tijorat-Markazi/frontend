/*
 * Who is looking at the page. The company comes from the cookie session; the
 * e-mail is contact data the session (or the kit, once saved) holds. Nothing
 * here keeps a login or a password.
 *
 *   const visitor = useVisitor();
 *   visitor.company   the signed-in company, or null for anyone else
 *   visitor.email     "" until an address is known
 *   visitor.refresh() re-reads both, after identity.setPerson or a sign-in
 */
import { useCallback, useState } from "react";
import { companyIdentity, identity } from "../../shell/market";
import type { CompanySession } from "../../shell/market";
import { useSession } from "../../shell/session";

export type Visitor = { company: CompanySession | null; email: string; name: string; refresh: () => void };

export function useVisitor(): Visitor {
  /* Subscribes the page to sign-in, sign-out and expiry. */
  useSession();
  /* An address saved through identity.setPerson lives in the kit, not in React. */
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(version => version + 1), []);
  return { company: companyIdentity.company(), email: identity.email(), name: identity.name(), refresh };
}
