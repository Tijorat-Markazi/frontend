import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { companyIdentity, Field, formValues, listOf, marketJson, Msg, OptionSelect } from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import { categoryLabel } from "./parts";
import { parseProductMatch, REQUEST_CURRENCIES } from "./types";
import type { ProductMatch } from "./types";

/** Set when a visitor raises a request from a product's detail. */
export type RequestPrefill = { category: string; currency: string };

type RequestFormProps = {
  t: Translate;
  categories: readonly string[];
  prefill: RequestPrefill | null;
  onPublished: (matches: ProductMatch[]) => void;
};

function applyPrefill(form: HTMLFormElement, prefill: RequestPrefill): void {
  const category = form.elements.namedItem("category");
  if (category instanceof HTMLSelectElement) {
    category.value = prefill.category;
    /* A category the list does not offer falls back to "all". */
    if (category.selectedIndex < 0) category.value = "";
  }
  const currency = form.elements.namedItem("currency");
  if (currency instanceof HTMLSelectElement && REQUEST_CURRENCIES.some(code => code === prefill.currency)) {
    currency.value = prefill.currency;
  }
  form.querySelector<HTMLInputElement>("#frAmount")?.focus();
}

/* The standard Funding Request. Anonymous by default: it is a blind auction. */
export function RequestForm({ t, categories, prefill, onPublished }: RequestFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  /* Also runs when the category list arrives after the prefill did. */
  useEffect(() => {
    if (formRef.current && prefill) applyPrefill(formRef.current, prefill);
  }, [prefill, categories]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const { sharia, anonymous, ...fields } = formValues(form);
    const body = companyIdentity.withCompany(
      companyIdentity.withPerson({ ...fields, sharia: sharia !== undefined, anonymous: anonymous !== undefined }),
    );
    if (!fields.amount) {
      setNotice({ key: "ml_need_amount", kind: "err" });
      return;
    }
    const answer = await marketJson("/api/moliya/request", body);
    if (!answer.ok) {
      setNotice({ key: "ml_req_fail", kind: "err" });
      return;
    }
    const matches = listOf(answer.matches, parseProductMatch);
    setNotice({ key: "ml_req_ok", kind: "ok", n: matches.length });
    form.reset();
    onPublished(matches);
  };

  return (
    <form className="mk-card" id="mlReqForm" style={{ gap: 14 }} ref={formRef} onSubmit={handleSubmit}>
      <h3>{t("ml_req_new")}</h3>
      <div className="mk-form">
        <Field label={t("ml_f_amount")}>
          <input id="frAmount" name="amount" type="number" min="0" required />
        </Field>
        <Field label={t("ml_f_currency")}>
          <OptionSelect id="frCurrency" name="currency" options={REQUEST_CURRENCIES} />
        </Field>
        <Field label={t("ml_f_tenor")}>
          <input id="frTenor" name="tenor" type="number" min="0" />
        </Field>
        <Field label={t("ml_f_category")}>
          <select id="frCategory" name="category">
            <option value="">{t("ml_cat_all")}</option>
            {categories.map(code => (
              <option key={code} value={code}>
                {categoryLabel(t)(code)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("ml_f_purpose")} isWide>
          <textarea id="frPurpose" name="purpose" />
        </Field>
        <Field label={t("ml_f_sector")}>
          <input id="frSector" name="sector" />
        </Field>
        <Field label={t("ml_f_region")}>
          <input id="frRegion" name="region" />
        </Field>
        <Field label={t("ml_f_revenue")}>
          <input id="frRevenue" name="revenue" type="number" min="0" />
        </Field>
        <Field label={t("ml_f_collateral")} isWide>
          <input id="frCollateral" name="collateral" />
        </Field>
        <div className="mk-f wide">
          <div className="mk-checks">
            <label>
              <input type="checkbox" id="frSharia" name="sharia" /> <span>{t("ml_only_sharia")}</span>
            </label>
            <label>
              <input type="checkbox" id="frAnon" name="anonymous" defaultChecked /> <span>{t("ml_anon")}</span>
            </label>
          </div>
        </div>
        <Field label={t("ml_f_contact")} isWide>
          <input id="frContact" name="contact" />
        </Field>
      </div>
      <div className="mk-actions">
        <button className="btn btn-primary" type="submit">
          {t("ml_req_send")}
        </button>
      </div>
      <Msg notice={notice} t={t} id="mlReqMsg" />
    </form>
  );
}
