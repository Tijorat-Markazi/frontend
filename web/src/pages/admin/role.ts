import { auth } from "../../shell/session";
import type { ViewId } from "./navItems";

/* Two roles open this page (TARGETS in the backend, srv/auth.js). */
export type PanelRole = "admin" | "rais";

/* What the rais may open, as admin.js lists it in buildNav and renderView.
   The server decides what a rais is answered; this only keeps the panel
   from offering the views admin.js hides from that role. */
const RAIS_VIEWS: readonly ViewId[] = ["dashboard", "projects", "chat", "questions", "appeals", "buyers"];

export const canOpen = (role: PanelRole, view: ViewId): boolean => role !== "rais" || RAIS_VIEWS.includes(view);

/** The role of the full session that is open now, or null when it is not one of this panel. */
export function currentPanelRole(): PanelRole | null {
  const session = auth.current();
  if (!session?.authenticated || session.restricted) return null;
  return session.role === "admin" || session.role === "rais" ? session.role : null;
}
