import { useEffect, useState } from "react";
import { navigate } from "../../shell/navigate";
import { PageBackground } from "../../shell/PageBackground";
import { auth } from "../../shell/session";
import type { Session } from "../../shell/session";
import { GroupChat } from "./GroupChat";
import { backPageFor } from "./RoomList";
import type { BackPage } from "./RoomList";

type Entry = { backHref: BackPage } | { redirectTo: string } | { failure: string };

/* An analyst reads aggregates and a buyer shops: neither takes part in the
   members' chat, where commercially sensitive trade talk happens. */
const MEMBER_ROLES: readonly string[] = ["admin", "rais", "assoc", "company"];
const SIGN_IN = "kirish.html?next=chat.html";

/* The chat page has no login of its own. Who the visitor is comes from the
   cookie session alone; the server decides again on every request. */
function entryFor(session: Session): Entry {
  /* A session limited to the personal-data page is not a way in either. */
  if (!session.authenticated || session.restricted) return { redirectTo: SIGN_IN };
  /* Signed in, but not a member: back to their own cabinet, not to the sign-in page. */
  if (!MEMBER_ROLES.includes(session.role)) return { redirectTo: auth.safeTarget(session.target) ?? "index.html" };
  return { backHref: backPageFor(session.target) };
}

export function ChatPage() {
  /* Decided once, when the session first answers, as the legacy page does: a
     session that ends later shows up as refused requests inside the chat. */
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    let isCancelled = false;
    auth
      .ready()
      .then(entryFor)
      .catch((error: unknown): Entry => ({ failure: error instanceof Error ? error.message : String(error) }))
      .then(next => {
        if (!isCancelled) setEntry(next);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const redirectTo = entry && "redirectTo" in entry ? entry.redirectTo : null;
  useEffect(() => {
    if (redirectTo) navigate.replace(redirectTo);
  }, [redirectTo]);

  /* styles.css stops the page itself from scrolling under the chat. */
  useEffect(() => {
    document.body.classList.add("chat-page");
    return () => document.body.classList.remove("chat-page");
  }, []);

  if (!entry || "redirectTo" in entry) return null;
  return (
    <>
      <PageBackground />
      <div id="chatRoot">{"failure" in entry ? entry.failure : <GroupChat backHref={entry.backHref} />}</div>
    </>
  );
}
