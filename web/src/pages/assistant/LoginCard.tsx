import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "../../shell/i18n";
import { navigate } from "../../shell/navigate";
import { resolveLogin } from "../../shell/resolveLogin";

type LoginCardProps = {
  isOpen: boolean;
  /** Why the server could not be reached when the page opened, if it could not. */
  error: string;
  /** Demo access with a checked gmail address. Rejects with the reason of the server. */
  onGuest: (demoEmail: string) => Promise<void>;
};

const FOCUS_DELAY_MS = 50;
/* Demo access requires a @gmail.com address before entering the guest chat. */
const GMAIL = /^[^\s@]+@gmail\.com$/;

/* The unified sign-in: the server tries the pair against every account tier,
   opens the cookie session and names the cabinet to go to. Nothing is kept
   here: the password field is emptied as soon as it has been read. */
export function LoginCard({ isOpen, error, onGuest }: LoginCardProps) {
  const { t } = useI18n();
  const [hasLoginError, setHasLoginError] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => loginRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const login = (loginRef.current?.value ?? "").trim();
    const password = passwordRef.current?.value ?? "";
    if (passwordRef.current) passwordRef.current.value = "";
    if (!login && !password) {
      setHasLoginError(true);
      return;
    }
    setIsSubmitting(true);
    setHasLoginError(false);
    const target = await resolveLogin(login, password);
    if (target) {
      navigate.to(target);
      return;
    }
    setHasLoginError(true);
    setIsSubmitting(false);
  };

  const enterDemo = () => {
    const email = (demoRef.current?.value ?? "").trim().toLowerCase();
    if (!GMAIL.test(email)) {
      setDemoError(t("asst_demo_email_err"));
      demoRef.current?.focus();
      return;
    }
    setDemoError("");
    onGuest(email).catch((reason: unknown) => setDemoError(reason instanceof Error ? reason.message : String(reason)));
  };

  return (
    <div className="asst-login" id="asstLogin" hidden={!isOpen}>
      <form className="lcard" id="emailForm" onSubmit={event => void handleSubmit(event)}>
        <button
          type="button"
          className="lcard-close"
          id="loginClose"
          aria-label="Yopiş"
          title="Yopiş"
          onClick={() => navigate.to("index.html")}
        >
          ✕
        </button>
        <span className="ai-avatar">AI</span>
        <h2>{t("asst_login_title")}</h2>
        <p>{t("asst_login_sub")}</p>
        <div className="err" id="emailErr">
          {hasLoginError ? t("asst_login_err") : error}
        </div>
        <input type="text" id="loginInput" name="login" ref={loginRef} placeholder={t("asst_login_ph")} autoComplete="username" />
        <input
          type="password"
          id="passInput"
          name="password"
          ref={passwordRef}
          placeholder={t("asst_pass_ph")}
          autoComplete="current-password"
        />
        <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }} disabled={isSubmitting}>
          {t("asst_enter")}
        </button>
        <div className="asst-login-or">
          <span>{t("asst_demo_or")}</span>
        </div>
        <input
          type="email"
          id="demoEmailInput"
          ref={demoRef}
          placeholder={t("asst_demo_email_ph")}
          autoComplete="email"
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            enterDemo();
          }}
        />
        <div className="err" id="demoErr">
          {demoError}
        </div>
        <button className="btn btn-ghost btn-lg" type="button" id="demoBtn" style={{ width: "100%" }} onClick={enterDemo}>
          {t("asst_demo_btn")}
        </button>
      </form>
    </div>
  );
}
