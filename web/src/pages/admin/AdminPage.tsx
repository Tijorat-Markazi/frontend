import { useEffect } from "react";
import { useCabinetLogin } from "../../shell/cabinet";
import { PageBackground } from "../../shell/PageBackground";
import { useTheme } from "../../shell/useTheme";
import { AdminShell } from "./AdminShell";
import { seedDemoStore } from "./demoStore";
import { LoginForm } from "./LoginForm";
import { currentPanelRole } from "./role";
import type { PanelRole } from "./role";

/* The panel has no account record of its own to load: the session already
   says which of its two roles is signed in. */
const loadRole = async (): Promise<PanelRole | null> => currentPanelRole();

/** The administrator and rais panel: the sign-in card until the server session is one of theirs, then the shell. */
export function AdminPage() {
  const { state, submit, signOut } = useCabinetLogin<PanelRole>({
    role: ["admin", "rais"],
    ownPage: "admin.html",
    signIn: loadRole,
  });
  const { theme, toggleTheme } = useTheme();

  useEffect(seedDemoStore, []);

  return (
    <>
      <PageBackground />
      {/* Nothing is shown while the server is asked who is signed in. */}
      {state.status === "signedOut" && <LoginForm onSubmit={submit} />}
      {/* The old panel reloaded the page on logout; dropping the shell gives the
          same result, the sign-in card and a panel that starts again from the dashboard. */}
      {state.status === "signedIn" && (
        <AdminShell role={state.account} theme={theme} onToggleTheme={toggleTheme} onLogout={() => void signOut()} />
      )}
    </>
  );
}
