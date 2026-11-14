import type { FormEvent } from "react";
import { companyIdentity, Field, formValues, identity, marketJson, Msg, OptionSelect } from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import { PASSPORT_CURRENCIES } from "./types";
import type { Passport } from "./types";

type PassportFormProps = {
  t: Translate;
  /** The stored passport, or null before the first save. */
  passport: Passport | null;
  /** Kept by the cabinet: the form is rebuilt from the saved passport after a save. */
  notice: Notice | null;
  onNotice: (notice: Notice) => void;
  onSaved: () => void;
};

/* Zero means "not given" for every passport figure. */
const shown = (value: number | undefined): string | number => value || "";

export function PassportForm({ t, passport, notice, onNotice, onSaved }: PassportFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!identity.email()) {
      onNotice({ key: "ml_need_email", kind: "err" });
      return;
    }
    /* The owner's name travels as the person's name, not as a passport field. */
    const ownerName = form.querySelector<HTMLInputElement>("#fpName")?.value.trim() ?? "";
    if (!(await identity.setPerson(identity.email(), ownerName))) return;
    const answer = await marketJson("/api/moliya/passport", companyIdentity.withPerson(formValues(form)));
    if (!answer.ok) {
      onNotice({ key: "ml_save_fail", kind: "err" });
      return;
    }
    onNotice({ key: "ml_save_ok", kind: "ok" });
    onSaved();
  };

  const currency = PASSPORT_CURRENCIES.find(code => code === passport?.currency);
  return (
    <>
      <h3>{t("ml_passport_edit")}</h3>
      <form className="mk-form" id="mlPassForm" onSubmit={handleSubmit}>
        <Field label={t("ml_f_name")}>
          <input id="fpName" defaultValue={passport ? passport.ownerName : identity.name()} />
        </Field>
        <Field label={t("ml_f_sector")}>
          <input id="fpSector" name="sector" defaultValue={passport?.sector} />
        </Field>
        <Field label={t("ml_f_region")}>
          <input id="fpRegion" name="region" defaultValue={passport?.region} />
        </Field>
        <Field label={t("ml_legal")}>
          <input id="fpLegal" name="legalForm" defaultValue={passport?.legalForm} />
        </Field>
        <Field label={t("ml_founded")}>
          <input id="fpFounded" name="founded" type="number" defaultValue={shown(passport?.founded)} />
        </Field>
        <Field label={t("ml_employees")}>
          <input id="fpEmployees" name="employees" type="number" defaultValue={shown(passport?.employees)} />
        </Field>
        <Field label={t("ml_f_revenue")}>
          <input id="fpRevenue" name="revenue" type="number" defaultValue={shown(passport?.revenue)} />
        </Field>
        <Field label="EBITDA">
          <input id="fpEbitda" name="ebitda" type="number" defaultValue={shown(passport?.ebitda)} />
        </Field>
        <Field label={t("ml_f_currency")}>
          <OptionSelect id="fpCurrency" name="currency" options={PASSPORT_CURRENCIES} defaultValue={currency} />
        </Field>
        <Field label={t("ml_need")}>
          <input id="fpNeed" name="need" type="number" defaultValue={shown(passport?.need)} />
        </Field>
        <Field label={t("ml_f_tenor")}>
          <input id="fpTenor" name="tenor" type="number" defaultValue={shown(passport?.tenor)} />
        </Field>
        <Field label={t("ml_collateral_value")}>
          <input id="fpCollValue" name="collateralValue" type="number" defaultValue={shown(passport?.collateralValue)} />
        </Field>
        <Field label={t("ml_f_purpose")} isWide>
          <textarea id="fpPurpose" name="purpose" defaultValue={passport?.purpose} />
        </Field>
        <Field label={t("ml_f_collateral")} isWide>
          <input id="fpCollateral" name="collateral" defaultValue={passport?.collateral} />
        </Field>
        <Field label={t("ml_docs")} isWide>
          <input id="fpDocs" name="docs" defaultValue={passport?.docs.join(", ")} />
        </Field>
        <Field label={t("ml_risks")} isWide>
          <textarea id="fpRisks" name="risks" defaultValue={passport?.risks} />
        </Field>
        <div className="mk-actions wide">
          <button className="btn btn-primary" type="submit">
            {t("ml_save")}
          </button>
          <Msg notice={notice} t={t} id="mlPassMsg" />
        </div>
        <p className="mk-note wide">{t("ml_passport_note")}</p>
      </form>
    </>
  );
}
