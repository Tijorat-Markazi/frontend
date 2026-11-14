import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Translate } from "../../shell/market";

type LoginCardProps = {
  t: Translate;
  /** The cabinet's one sign-in; false means "wrong login or password". */
  onSubmit: (login: string, password: string) => Promise<boolean>;
};

export function LoginCard({ t, onSubmit }: LoginCardProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    setHasFailed(false);
    /* The password leaves the field the moment it is handed over, so it is
       not left on screen behind a refusal. */
    const typed = password;
    setPassword("");
    /* An account of another tier is sent to its own cabinet by the sign-in
       itself, rather than being told its password is wrong. */
    const isAccepted = await onSubmit(login, typed);
    /* An accepted sign-in replaces this card with the cabinet. */
    if (!isMounted.current) return;
    setIsBusy(false);
    setHasFailed(!isAccepted);
  };

  return (
    <section className="admin-login" id="anLogin">
      <form className="an-login-card" id="anForm" onSubmit={handleSubmit}>
        <span className="eyebrow">{t("an_eyebrow")}</span>
        <h1 id="anLgTitle">{t("an_title")}</h1>
        <p className="co-sub" id="anLgSub">
          {t("an_login_sub")}
        </p>
        <input
          id="anLogin1"
          placeholder="Login"
          aria-label="Login"
          autoComplete="username"
          required
          value={login}
          onChange={event => setLogin(event.target.value)}
        />
        <input
          id="anPass"
          type="password"
          placeholder="Parol"
          aria-label="Parol"
          autoComplete="current-password"
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <button className="btn btn-primary" type="submit" id="anLgBtn" disabled={isBusy}>
          {t("an_login_btn")}
        </button>
        <p className="an-err" id="anErr" role="alert">
          {hasFailed && t("an_bad_creds")}
        </p>
        <a className="an-back" href="index.html" id="anBackSite">
          {t("an_back")}
        </a>
      </form>
    </section>
  );
}
