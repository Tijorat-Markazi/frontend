import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Localized } from "@legacy/data.js";
import { useI18n } from "../../shell/i18n";
import { PublicPage } from "../../shell/PublicPage";
import { auth } from "../../shell/session";
import { ConferenceCard } from "./ConferenceCard";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID = "invalid";
const AVATAR_STYLE = {
  width: 30,
  height: 30,
  fontSize: 13,
  display: "inline-grid",
  placeItems: "center",
  verticalAlign: "middle",
} as const;

const TEXT = {
  title: ["Konferensiyaga kiriş", "Вход на конференцию", "Join the conference"],
  sub: [
    "Email kiriting — konferensiyaga qöşiliş uçun.",
    "Введите email, чтобы присоединиться к конференции.",
    "Enter your email to join the conference.",
  ],
  button: ["Davom etiş →", "Продолжить →", "Continue →"],
  invalid: ["Töğri email kiriting", "Введите корректный email", "Enter a valid email"],
  switchEmail: ["Boşqa email", "Сменить email", "Switch email"],
} satisfies Record<string, Localized>;

type Phase = "starting" | "gate" | "joined";

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function ConferencePage() {
  const { pick } = useI18n();
  const [phase, setPhase] = useState<Phase>("starting");
  const [email, setEmail] = useState("");
  const [isAccount, setIsAccount] = useState(false);
  /* INVALID is translated when shown; anything else is the server's message. */
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCurrent = true;
    auth
      .ready()
      .then(session => {
        if (!isCurrent) return;
        const known = session.user?.email || session.guest?.email || session.user?.name || "";
        setEmail(known);
        /* A rights-only session may reach nothing but the personal-data page. */
        const isAccount = session.authenticated && !session.restricted;
        setIsAccount(isAccount);
        setPhase(isAccount || EMAIL_PATTERN.test(known) ? "joined" : "gate");
      })
      .catch((reason: unknown) => {
        if (!isCurrent) return;
        setPhase("gate");
        setError(messageOf(reason));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (phase === "gate") inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setError(INVALID);
      return;
    }
    try {
      await auth.guest(value, "");
      setEmail(value);
      setError("");
      setPhase("joined");
    } catch (reason: unknown) {
      setError(messageOf(reason));
    }
  };

  const handleSwitch = () => {
    setEmail("");
    setPhase("gate");
  };

  return (
    <PublicPage action={{ href: "index.html", labelKey: "d_home" }} footer={null}>
      <div className="asst-login" id="confLogin" hidden={phase !== "gate"}>
        <form className="lcard" id="emailForm" onSubmit={event => void handleSubmit(event)}>
          <span className="ai-avatar">@</span>
          <h2 id="lgTitle">{pick(TEXT.title)}</h2>
          <p id="lgSub">{pick(TEXT.sub)}</p>
          <div className="err" id="emailErr">
            {error === INVALID ? pick(TEXT.invalid) : error}
          </div>
          <input ref={inputRef} type="email" id="emailInput" name="email" placeholder="email@example.com" autoComplete="email" />
          <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }} id="lgBtn">
            {pick(TEXT.button)}
          </button>
        </form>
      </div>

      <main className="conf-page" id="confApp" hidden={phase !== "joined"}>
        <div className="container">
          <div className="conf-userbar">
            <span>
              <span className="ai-avatar" style={AVATAR_STYLE}>
                @
              </span>{" "}
              <b id="uEmail">{email || "—"}</b>
            </span>
            <button className="asst-logout-link" id="switchEmail" type="button" hidden={isAccount} onClick={handleSwitch}>
              {pick(TEXT.switchEmail)}
            </button>
          </div>

          <div className="conf-card panel" id="confCard">
            {phase === "joined" && <ConferenceCard key={email} />}
          </div>
        </div>
      </main>
    </PublicPage>
  );
}
