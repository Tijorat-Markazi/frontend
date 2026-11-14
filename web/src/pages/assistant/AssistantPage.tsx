import { useEffect, useState } from "react";
import { useI18n } from "../../shell/i18n";
import { PublicPage } from "../../shell/PublicPage";
import type { HeaderAction } from "../../shell/SiteHeader";
import { auth, useSession } from "../../shell/session";
import type { Session } from "../../shell/session";
import { ping } from "./assistantApi";
import { AssistantSidebar } from "./AssistantSidebar";
import { ChatPanel } from "./ChatPanel";
import { LoginCard } from "./LoginCard";
import { useAssistantChat } from "./useAssistantChat";
import type { Backend, Visitor } from "./useAssistantChat";

/* For a signed-in account this is their own AI page, not the public site: the
   site navigation goes, and the remaining buttons stay pinned to the right
   now that the navigation no longer pushes them there. */
const CABINET_HEADER = "#nav,#burger{display:none}.header-actions{margin-left:auto}";

/* A full session is used as it is, with no sign-in step. A restricted one may
   only reach the personal-data page, so here it counts as signed out. */
function accountOf(session: Session | null): Visitor | null {
  if (!session?.authenticated || session.restricted || !session.user) return null;
  const { user } = session;
  return {
    kind: "account",
    id: `${session.role}:${user.id ?? user.login ?? ""}`,
    label: user.name || user.login || user.email || "",
    home: auth.safeTarget(session.target) ?? "index.html",
  };
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type Probe = { backend: Backend; error: string };

/* Nothing is shown until the session and the server have answered. */
function useBackend(): Probe | null {
  const [probe, setProbe] = useState<Probe | null>(null);
  useEffect(() => {
    let isCancelled = false;
    void ping()
      .then(({ isAiOn }): Probe => ({ backend: { hasBackend: true, isAiOn }, error: "" }))
      .catch((error: unknown): Probe => ({ backend: { hasBackend: false, isAiOn: false }, error: message(error) }))
      .then(result => {
        if (!isCancelled) setProbe(result);
      });
    return () => {
      isCancelled = true;
    };
  }, []);
  return probe;
}

type AssistantAppProps = {
  visitor: Visitor;
  backend: Backend;
  /** Ends the demo. Rejects with the reason when the server cannot do it. */
  onSignIn: () => Promise<void>;
};

function AssistantApp({ visitor, backend, onSignIn }: AssistantAppProps) {
  const { t } = useI18n();
  const chat = useAssistantChat(visitor, backend);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leave = () => {
    onSignIn().catch((error: unknown) => setLeaveError(message(error)));
  };
  return (
    <div className="container">
      <div className="asst-grid">
        <AssistantSidebar
          visitor={visitor}
          isAiOn={backend.isAiOn}
          sessions={chat.sessions}
          currentId={chat.current?.id}
          onNewChat={chat.newChat}
          onOpenSession={chat.openSession}
          onSignIn={leave}
        />
        <div>
          <ChatPanel chat={{ ...chat, problem: chat.problem ?? leaveError }} hasBackend={backend.hasBackend} />
          <p className="asst-disclaimer">{t("asst_disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

export function AssistantPage() {
  const { t } = useI18n();
  const session = useSession();
  const probe = useBackend();
  /* Set by the demo button only: a reload asks again, there is no silent resume. */
  const [guest, setGuest] = useState<Visitor | null>(null);

  /* With the server out of reach the page stops at the sign-in card. */
  const account = probe?.backend.hasBackend ? accountOf(session) : null;
  const visitor = account ?? guest;

  /* The server ties the address to the guest cookie of this browser and counts
     the free questions against it. Rejects with the reason it gives. */
  const startGuest = async (demoEmail: string) => {
    const next = await auth.guest(demoEmail, "");
    setGuest({ kind: "guest", demoEmail: next.guest?.email ?? "" });
  };

  const showLogin = async () => {
    await auth.logout();
    setGuest(null);
  };

  const isAccount = visitor?.kind === "account";
  const action: HeaderAction = isAccount
    ? { href: visitor.home, label: `← ${t("asst_back_panel")}` }
    : { href: "index.html", labelKey: "d_home" };

  return (
    /* The site footer belongs to public pages. Once the chat is open this is a
       panel like the cabinets, which carry none; the sign-in card keeps it. */
    <PublicPage action={action} footer={visitor ? null : undefined}>
      {isAccount && <style>{CABINET_HEADER}</style>}
      <LoginCard isOpen={probe !== null && visitor === null} error={probe?.error ?? ""} onGuest={startGuest} />
      <main className="asst-page" id="asstApp" hidden={!probe || visitor === null}>
        {probe && visitor && (
          <AssistantApp
            key={visitor.kind === "account" ? visitor.id : `guest:${visitor.demoEmail}`}
            visitor={visitor}
            backend={probe.backend}
            onSignIn={showLogin}
          />
        )}
      </main>
    </PublicPage>
  );
}
