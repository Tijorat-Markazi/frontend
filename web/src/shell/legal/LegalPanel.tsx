/**
 * LEGAL PANEL — "Maʼlumotlarim va huquqlarim" (port of legal-settings.js).
 *
 * The four rights under articles 21-22 of ZRU-547, implemented once: the
 * standalone rights page and every cabinet's settings render this same panel.
 *
 *   <LegalPanel
 *     panelClass="admin-panel"                   // the cabinet's own card class
 *     showCorrection                              // adds "correct it in your profile"
 *     onWithdrawn={() => …}                       // after the withdrawal: leave the cabinet
 *   />
 *
 * Who is asking is the cookie session's business: the panel takes no
 * credentials and renders nothing for a visitor who is not signed in. A
 * restricted session (opened for the personal-data page only) is enough.
 * Without onWithdrawn the panel ends the server session and goes to the home
 * page. It carries its own strings, so it works under any page dictionary.
 * Needs the I18nProvider and legal.css.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { LANGS } from "@legacy/data.js";
import type { Localized } from "@legacy/data.js";
import { useI18n } from "../i18n";
import { goTo } from "../navigate";
import { auth } from "../session";
import { useLegalGate } from "./LegalGate";
import { downloadExport, formatRecordDay, postLegal, readPanelData } from "./panelData";
import type { PanelData } from "./panelData";
import { PANEL_DOCS, PANEL_TEXT } from "./panelText";
import type { PanelTextKey } from "./panelText";
import { ConsentBlock, RequestsTable } from "./LegalPanelParts";

/* Long enough to read "signing out" before the page changes. */
const SIGN_OUT_DELAY_MS = 1400;

type LegalPanelProps = {
  panelClass?: string;
  showCorrection?: boolean;
  onWithdrawn?: () => void;
};

type PanelState = { status: "loading" | "empty" | "failed" } | { status: "ready"; data: PanelData };
/* The key, not the text, so the message follows a language switch. */
type Notice = { key: PanelTextKey; isError: boolean; values?: Record<string, string> };

export type PanelTranslate = (key: PanelTextKey) => string;

function usePanelText(): PanelTranslate {
  const { lang } = useI18n();
  const index = LANGS.indexOf(lang);
  return key => {
    const row: Localized = PANEL_TEXT[key];
    return row[index] || row[0];
  };
}

function signOutHome(): void {
  /* The withdrawal has already closed the account, so the page leaves even
     when ending the session cannot be confirmed. */
  void auth
    .logout()
    .catch(() => undefined)
    .then(() => goTo("index.html"));
}

async function isSignedIn(): Promise<boolean> {
  try {
    return (await auth.ready()).authenticated;
  } catch {
    return false;
  }
}

export function LegalPanel({ panelClass = "admin-panel", showCorrection, onWithdrawn }: LegalPanelProps) {
  const { lang } = useI18n();
  const text = usePanelText();
  const { gate, openReadOnly } = useLegalGate();
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [note, setNote] = useState("");
  const [word, setWord] = useState("");
  const latestLoad = useRef(0);
  const latestOnWithdrawn = useRef(onWithdrawn);
  useEffect(() => {
    latestOnWithdrawn.current = onWithdrawn;
  });

  const load = useCallback(async () => {
    const run = ++latestLoad.current;
    if (!(await isSignedIn())) {
      if (run === latestLoad.current) setState({ status: "empty" });
      return;
    }
    const answer = await postLegal("/api/legal/export");
    if (run !== latestLoad.current) return;
    setState(answer?.ok ? { status: "ready", data: readPanelData(answer.data) } : { status: "failed" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleErase = async () => {
    const answer = await postLegal("/api/legal/erase", { note: note.trim() });
    if (!answer?.ok) return;
    const values = { ref: String(answer.ref ?? ""), due: formatRecordDay(answer.due) };
    setNotice({ key: "erase_ok", isError: false, values });
    setNote("");
    void load();
  };

  /* Withdrawal takes effect the moment it returns and closes the cabinet the
     person is standing in, so it asks for a typed word: not a thing to misclick. */
  const handleWithdraw = async () => {
    if (word.trim().toUpperCase() !== text("wd_word").toUpperCase()) {
      setNotice({ key: "wd_need", isError: true });
      return;
    }
    const answer = await postLegal("/api/legal/withdraw");
    if (answer?.error === "already_withdrawn") {
      setNotice({ key: "wd_already", isError: true });
      return;
    }
    if (!answer?.ok) return;
    setNotice({ key: "wd_bye", isError: false });
    setTimeout(() => (latestOnWithdrawn.current ?? signOutHome)(), SIGN_OUT_DELAY_MS);
  };

  if (state.status === "empty") return null;
  if (state.status !== "ready") {
    return (
      <div className={panelClass}>
        <p className="ac-label">{text(state.status === "failed" ? "failed" : "loading")}</p>
      </div>
    );
  }

  const { data } = state;
  const docLang = lang === "ru" ? "ru" : "uz";
  const noticeText = notice
    ? Object.entries(notice.values ?? {}).reduce(
        (message, [token, value]) => message.replace(`{${token}}`, value),
        text(notice.key),
      )
    : "";

  return (
    <div className={`${panelClass} lg-settings`}>
      <h2>{text("h")}</h2>
      <p className="lg-set-intro">{text("intro")}</p>

      <section className="lg-set-sec">
        <h3>{text("docs_h")}</h3>
        <p className="lg-links">
          {PANEL_DOCS.map(([href, title], index) => (
            <span key={href}>
              {index > 0 && " "}
              <a href={href} target="_blank" rel="noreferrer">
                {title[docLang]} →
              </a>
            </span>
          ))}
        </p>
        <button type="button" className="btn btn-ghost" id="lgsOferta" onClick={openReadOnly}>
          {text("reread")}
        </button>
      </section>

      <section className="lg-set-sec">
        <h3>{text("consent_h")}</h3>
        <ConsentBlock consent={data.consent} text={text} />
      </section>

      <section className="lg-set-sec">
        <h3>{text("export_h")}</h3>
        <p>{text("export_p")}</p>
        <button type="button" className="btn btn-primary" id="lgsDl" onClick={() => downloadExport(data.raw)}>
          {text("export_btn")}
        </button>
      </section>

      {showCorrection && (
        <section className="lg-set-sec">
          <h3>{text("fix_h")}</h3>
          <p>{text("fix_p")}</p>
        </section>
      )}

      {data.requests.length > 0 && (
        <section className="lg-set-sec">
          <h3>{text("reqs_h")}</h3>
          <RequestsTable requests={data.requests} text={text} />
        </section>
      )}

      <section className="lg-set-sec">
        <h3>{text("erase_h")}</h3>
        <div className="lg-note">{text("erase_p")}</div>
        <label className="lg-set-lbl" htmlFor="lgsNote">
          {text("erase_note")}
        </label>
        <textarea
          id="lgsNote"
          rows={2}
          maxLength={1000}
          className="lg-set-ta"
          value={note}
          onChange={event => setNote(event.target.value)}
        />
        <button type="button" className="btn btn-ghost" id="lgsErase" onClick={handleErase}>
          {text("erase_btn")}
        </button>
      </section>

      <section className="lg-set-sec lg-set-danger">
        <h3>{text("wd_h")}</h3>
        <div className="lg-note lg-note-warn">{text("wd_warn")}</div>
        <label className="lg-set-lbl" htmlFor="lgsWord">
          {text("wd_type")}
        </label>
        <input
          id="lgsWord"
          className="lg-set-in"
          spellCheck={false}
          autoComplete="off"
          placeholder={text("wd_word")}
          value={word}
          onChange={event => setWord(event.target.value)}
        />
        <button type="button" className="btn btn-ghost" id="lgsWd" onClick={handleWithdraw}>
          {text("wd_btn")}
        </button>
        <p className={notice ? `lg-set-msg ${notice.isError ? "err" : "ok"}` : "lg-set-msg"} id="lgsMsg" hidden={!notice}>
          {noticeText}
        </p>
      </section>
      {gate}
    </div>
  );
}
