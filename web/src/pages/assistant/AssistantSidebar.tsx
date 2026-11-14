import { useI18n } from "../../shell/i18n";
import type { SessionMeta } from "./assistantApi";
import type { Visitor } from "./useAssistantChat";

type AssistantSidebarProps = {
  visitor: Visitor;
  isAiOn: boolean;
  sessions: readonly SessionMeta[];
  currentId: string | undefined;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  /** A guest leaves the demo for the sign-in card. */
  onSignIn: () => void;
};

function sessionTime(updated: number): string {
  const date = new Date(updated);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function AssistantSidebar(props: AssistantSidebarProps) {
  const { visitor, isAiOn, sessions, currentId, onNewChat, onOpenSession, onSignIn } = props;
  const { t } = useI18n();
  const isGuest = visitor.kind === "guest";
  const account = isGuest ? visitor.demoEmail || t("asst_guest_label") : visitor.label;

  return (
    <aside className="asst-aside">
      <div className="panel">
        <div className="asst-userbox">
          <div className="uemail">
            <span className="ai-avatar">@</span>
            <span id="uEmail">{account}</span>
          </div>
          <span className="demo-pill" id="aiStatus" style={{ color: isAiOn ? "var(--green)" : "var(--gold)" }}>
            {isAiOn ? t("asst_ai_on") : t("asst_ai_off")}
          </span>
          <div className="urow">
            <button className="btn btn-primary" id="newChatBtn" type="button" onClick={onNewChat}>
              {t("asst_new")}
            </button>
          </div>
          {/* An account signs out from the header; only a guest can switch here. */}
          <button className="asst-logout-link" id="switchEmail" type="button" hidden={!isGuest} onClick={onSignIn}>
            {t("asst_signin_email")}
          </button>
        </div>
      </div>
      {/* The chats of a guest are not kept, so there is no history to list. */}
      <div className="panel" id="histPanel" hidden={isGuest}>
        <h4>{t("asst_history")}</h4>
        <div className="session-list" id="sessionList">
          {sessions.length === 0 && <p className="session-empty">{t("asst_hist_empty")}</p>}
          {sessions.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === currentId ? "session-item active" : "session-item"}
              onClick={() => onOpenSession(item.id)}
            >
              <b>{item.title}</b>
              <span>{sessionTime(item.updated)}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
