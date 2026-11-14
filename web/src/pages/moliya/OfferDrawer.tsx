import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { companyIdentity, Drawer, Field, formValues, marketJson, OptionSelect } from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import { REQUEST_CURRENCIES } from "./types";
import type { OfferTarget } from "./types";

/* Long enough to read "Offer sent." before the drawer closes. */
const CLOSE_DELAY_MS = 900;

type OfferDrawerProps = { target: OfferTarget; t: Translate; onClose: () => void; onSent: () => void };

/* A provider's indicative offer on one funding request. Only a signed-in company gets here. */
export function OfferDrawer({ target, t, onClose, onSent }: OfferDrawerProps) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const answer = await marketJson(
      "/api/moliya/offer",
      companyIdentity.withCompany({ requestId: target.id, ...formValues(event.currentTarget) }),
    );
    if (!answer.ok) {
      setNotice({ key: "ml_offer_fail", kind: "err" });
      return;
    }
    setNotice({ key: "ml_offer_ok", kind: "ok" });
    closeTimer.current = window.setTimeout(() => {
      onClose();
      onSent();
    }, CLOSE_DELAY_MS);
  };

  const currency = REQUEST_CURRENCIES.find(code => code === target.currency);
  return (
    <Drawer title={t("ml_make_offer")} onClose={onClose}>
      <form className="mk-form" id="mlOfferForm" onSubmit={handleSubmit}>
        <Field label={t("ml_f_amount")}>
          <input id="ofAmount" name="amount" type="number" defaultValue={target.amount || ""} />
        </Field>
        <Field label={t("ml_f_currency")}>
          <OptionSelect id="ofCurrency" name="currency" options={REQUEST_CURRENCIES} defaultValue={currency} />
        </Field>
        <Field label={`${t("ml_rate")} (%)`}>
          <input id="ofRate" name="ratePct" type="number" step="0.01" required />
        </Field>
        <Field label={`${t("ml_fee")} (%)`}>
          <input id="ofFee" name="feePct" type="number" step="0.01" />
        </Field>
        <Field label={t("ml_f_tenor")}>
          <input id="ofTenor" name="tenor" type="number" defaultValue={target.tenor || ""} />
        </Field>
        <Field label={t("ml_grace")}>
          <input id="ofGrace" name="grace" type="number" />
        </Field>
        <Field label={t("ml_f_collateral")} isWide>
          <input id="ofCollateral" name="collateral" />
        </Field>
        <Field label={t("ml_covenants")} isWide>
          <textarea id="ofCovenants" name="covenants" />
        </Field>
        <Field label={t("ml_conditions")} isWide>
          <textarea id="ofConditions" name="conditions" />
        </Field>
        <Field label={t("ml_validity")}>
          <input id="ofValidity" name="validity" type="date" />
        </Field>
        <Field label={`SLA (${t("ml_days")})`}>
          <input id="ofSla" name="slaDays" type="number" />
        </Field>
        <div className="mk-actions wide">
          <button className="btn btn-primary" type="submit">
            {t("ml_send_offer")}
          </button>
        </div>
        <p className="mk-note wide">{t("ml_offer_note")}</p>
        {/* Spans the form grid, which the kit's <Msg> cannot be told to do. */}
        <p className={notice ? `mk-msg wide is-${notice.kind}` : "mk-msg wide"} id="mlOfMsg" hidden={!notice}>
          {notice && t(notice.key)}
        </p>
      </form>
    </Drawer>
  );
}
