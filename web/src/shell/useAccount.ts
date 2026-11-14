import { useState } from "react";
import { dialogs } from "./dialogs";
import { auth, useSession } from "./session";

interface Account {
  /** The cabinet this session belongs to, or null when signed out. */
  panelUrl: string | null;
  isLoggingOut: boolean;
  logout: () => void;
}

export function useAccount(): Account {
  const session = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /* A restricted session may only reach the personal-data rights page. */
  const panelUrl =
    session?.authenticated && !session.restricted ? (auth.safeTarget(session.target) ?? "index.html") : null;

  const logout = () => {
    setIsLoggingOut(true);
    auth
      .logout()
      .then(() => {
        window.location.href = "kirish.html";
      })
      .catch((error: unknown) => {
        setIsLoggingOut(false);
        void dialogs.alert(error instanceof Error ? error.message : String(error));
      });
  };

  return { panelUrl, isLoggingOut, logout };
}
