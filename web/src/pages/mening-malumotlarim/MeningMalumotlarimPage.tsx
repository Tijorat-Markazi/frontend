import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { T_DSR } from "@legacy/dsr-i18n.js";
import { LegalPanel } from "../../shell/legal/LegalPanel";
import { useMarketText } from "../../shell/market/mk";
import type { Translate } from "../../shell/market/mk";
import { PublicPage } from "../../shell/PublicPage";
import { auth, useSession } from "../../shell/session";

/* The standalone rights page. The rights live in every cabinet's settings; this
   page covers the two cases a cabinet cannot: a reader of the privacy policy
   who is not signed in, and someone whose access was suspended, including by
   their own withdrawal of consent. All it does is establish who is asking and
   hand over to the same LegalPanel the cabinets render.

   Who is asking is the server session and nothing else. A visitor who is not
   signed in opens a RESTRICTED session here: the server grants it to company,
   association and buyer accounts only (suspended ones included), and it reaches
   the rights endpoints and no other part of the site. Nothing typed into the
   form is kept. */

/* The purpose that makes /api/auth/login open the restricted session. */
const RIGHTS_PURPOSE = "rights";

/** False until the session has been asked for once, so a signed-in visitor is never shown the form first. */
function useSessionChecked(): boolean {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    /* A session service that cannot be reached reads as signed out; the form's
       own attempt then reports the refusal. */
    void auth
      .ready()
      .catch(() => undefined)
      .then(() => {
        if (isCurrent) setIsChecked(true);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return isChecked;
}

function SignInForm({ t }: { t: Translate }) {
  const [hasFailed, setHasFailed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSending(true);
    try {
      /* On success the session changes and the page swaps this form for the
         panel, so there is nothing left to do here. */
      await auth.login(String(data.get("login") ?? "").trim(), String(data.get("password") ?? ""), RIGHTS_PURPOSE);
    } catch {
      /* A refused pair, an account of another kind, or no answer: the server
         does not say which, and neither does the page. The fields are emptied,
         as production redraws the form. */
      form.reset();
      setHasFailed(true);
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="lg-note lg-note-info">{t("dsr_login_why")}</div>
      <form className="rg-card" id="dsrLogin" style={{ maxWidth: 420 }} onSubmit={handleSubmit}>
        <h2>{t("dsr_login_h")}</h2>
        <div className="mk-form">
          <div className="mk-f wide">
            <label htmlFor="dsrLg">{t("dsr_lg")}</label>
            <input id="dsrLg" name="login" autoComplete="username" spellCheck={false} required />
          </div>
          <div className="mk-f wide">
            <label htmlFor="dsrPw">{t("dsr_pw")}</label>
            <input id="dsrPw" name="password" type="password" autoComplete="current-password" required />
          </div>
        </div>
        <div className="mk-actions">
          <button className="btn btn-primary" type="submit" disabled={isSending}>
            {t("dsr_login_btn")}
          </button>
        </div>
        {hasFailed && <p className="mk-msg err">{t("dsr_login_bad")}</p>}
      </form>
    </>
  );
}

export function MeningMalumotlarimPage() {
  const t = useMarketText(T_DSR);
  const session = useSession();
  const isChecked = useSessionChecked();
  /* Any signed-in session is taken as it is, full or restricted, and no second
     sign-in is asked for. An account the rights do not cover (an administrator,
     say) is refused by the export itself, and the panel says so. */
  const isSignedIn = session?.authenticated === true;

  return (
    <PublicPage hideServices hasMonumentBackground={false} hasSessionActions={false}>
      <main>
        <article className="lg-page">
          <div className="container lg-inner">
            <header className="lg-head">
              <h1>{t("dsr_h1")}</h1>
              <p className="lg-stamp">{t("dsr_sub")}</p>
            </header>

            <div id="dsrBody" className="lg-body">
              {/* No onWithdrawn: the panel's own ending is this page's too. It
                  ends the server session, then goes to the home page. */}
              {isChecked && isSignedIn && <LegalPanel panelClass="lg-page-panel" showCorrection />}
              {isChecked && !isSignedIn && <SignInForm t={t} />}
            </div>
          </div>
        </article>
      </main>
    </PublicPage>
  );
}
