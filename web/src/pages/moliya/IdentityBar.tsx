/*
 * The strip above the cabinet: the contact e-mail on the left, the company
 * sign-in (or the signed-in company and its sign-out) on the right.
 *
 * The pair typed here goes to companyLogin once and is kept nowhere; the
 * password leaves the field whatever the answer.
 */
import { useState } from "react";
import { companyLogin, companyLogout, identity } from "../../shell/market";
import type { Translate } from "../../shell/market";
import type { Visitor } from "./visitor";

function CompanySignIn({ t, onChanged }: { t: Translate; onChanged: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [hasFailed, setHasFailed] = useState(false);

  const signIn = async (): Promise<void> => {
    const typed = password;
    setPassword("");
    const company = await companyLogin(login.trim(), typed);
    setHasFailed(company === null);
    if (company) onChanged();
  };

  return (
    <>
      <input
        id="mlLogin"
        placeholder={t("ml_login")}
        autoComplete="username"
        value={login}
        onChange={event => setLogin(event.target.value)}
      />
      <input
        id="mlPass"
        type="password"
        placeholder={t("ml_pass")}
        autoComplete="current-password"
        value={password}
        onChange={event => setPassword(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") void signIn();
        }}
      />
      <button className="btn btn-primary" type="button" id="mlIn" onClick={() => void signIn()}>
        {t("ml_enter")}
      </button>
      {hasFailed && (
        <span className="mk-msg is-err" role="alert">
          {t("ml_login_fail")}
        </span>
      )}
    </>
  );
}

type IdentityBarProps = { t: Translate; visitor: Visitor };

export function IdentityBar({ t, visitor }: IdentityBarProps) {
  const [email, setEmail] = useState(visitor.email);
  const { company } = visitor;

  const saveEmail = async (): Promise<void> => {
    if (await identity.setPerson(email.trim(), identity.name())) visitor.refresh();
  };
  const signOut = async (): Promise<void> => {
    await companyLogout();
    visitor.refresh();
  };

  return (
    <div className="mk-id" id="mlId">
      <span>{t("ml_id_email")}</span>
      <input
        id="mlEmail"
        type="email"
        placeholder="email@company.uz"
        value={email}
        onChange={event => setEmail(event.target.value)}
      />
      <button className="btn btn-ghost" type="button" id="mlSaveEmail" onClick={() => void saveEmail()}>
        {t("ml_save")}
      </button>
      <span className="mk-id-r">
        {company ? (
          <>
            <b>{company.name}</b>{" "}
            <button className="btn btn-ghost" type="button" id="mlOut" onClick={() => void signOut()}>
              {t("ml_logout")}
            </button>
          </>
        ) : (
          <CompanySignIn t={t} onChanged={visitor.refresh} />
        )}
      </span>
    </div>
  );
}
