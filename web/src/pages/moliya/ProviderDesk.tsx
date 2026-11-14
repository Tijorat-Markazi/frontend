/*
 * The provider desk of a signed-in company: the requests its products are
 * eligible for, its own catalogue and the form that adds a product. The server
 * decides whose desk this is from the session; no request names the company.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "../../shell/i18n";
import {
  companyIdentity,
  Empty,
  Field,
  formatMoney,
  formatNumber,
  formValues,
  marketJson,
  MatchCard,
  Msg,
  OptionSelect,
} from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import { BOX_HEADING, categoryLabel, ProductCard } from "./parts";
import { PRODUCT_CATEGORIES, REQUEST_CURRENCIES } from "./types";
import type { FinanceProduct, Lead } from "./types";

const MAX_LEADS = 5;

function LeadCard({ lead, t, onOffer }: { lead: Lead; t: Translate; onOffer: () => void }) {
  const { lang } = useI18n();
  const title = (
    <>
      {lead.product} ·{" "}
      <span style={{ color: "var(--muted)", fontWeight: 500 }}>
        {formatMoney(lead.amount, lead.currency, lang)} · {formatNumber(lead.tenor, lang, 0)} {t("ml_months")}
      </span>
    </>
  );
  return (
    <MatchCard match={lead} title={title}>
      <div className="mk-actions" style={{ marginTop: 8 }}>
        <button className="btn btn-ghost" type="button" data-offer={lead.id} onClick={onOffer}>
          {t("ml_make_offer")}
        </button>
      </div>
    </MatchCard>
  );
}

function ProductForm({ t, onSaved }: { t: Translate; onSaved: () => void }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const { sharia, ...fields } = formValues(form);
    const body = companyIdentity.withCompany({ ...fields, sharia: sharia !== undefined });
    const answer = await marketJson("/api/moliya/product", body);
    if (!answer.ok) {
      setNotice({ key: "ml_save_fail", kind: "err" });
      return;
    }
    setNotice({ key: "ml_save_ok", kind: "ok" });
    form.reset();
    onSaved();
  };

  return (
    <>
      <h3 style={BOX_HEADING}>{t("ml_add_product")}</h3>
      <form className="mk-form" id="mlProdForm" onSubmit={handleSubmit}>
        <Field label={t("ml_f_name")}>
          <input id="mpName" name="name" required />
        </Field>
        <Field label={t("ml_f_category")}>
          <OptionSelect id="mpCategory" name="category" options={PRODUCT_CATEGORIES} labelOf={categoryLabel(t)} />
        </Field>
        <Field label={t("ml_instrument")}>
          <input id="mpInstrument" name="instrument" />
        </Field>
        <Field label={t("ml_summary")} isWide>
          <textarea id="mpSummary" name="summary" />
        </Field>
        <Field label={t("ml_min")}>
          <input id="mpMin" name="minAmount" type="number" />
        </Field>
        <Field label={t("ml_max")}>
          <input id="mpMax" name="maxAmount" type="number" />
        </Field>
        <Field label={t("ml_f_currency")}>
          <OptionSelect id="mpCurrency" name="currency" options={REQUEST_CURRENCIES} />
        </Field>
        <Field label={t("ml_tenor_min")}>
          <input id="mpTenorMin" name="tenorMin" type="number" />
        </Field>
        <Field label={t("ml_tenor_max")}>
          <input id="mpTenorMax" name="tenorMax" type="number" />
        </Field>
        <Field label={t("ml_rate")}>
          <input id="mpRate" name="rate" placeholder="22-26%" />
        </Field>
        <Field label={t("ml_fee")}>
          <input id="mpFee" name="feeModel" />
        </Field>
        <Field label={`SLA (${t("ml_days")})`}>
          <input id="mpSla" name="sla" type="number" />
        </Field>
        <Field label={t("ml_f_collateral")} isWide>
          <input id="mpCollateral" name="collateral" />
        </Field>
        <Field label={t("ml_eligibility")} isWide>
          <textarea id="mpEligibility" name="eligibility" />
        </Field>
        <Field label={t("ml_docs")} isWide>
          <input id="mpDocs" name="docs" />
        </Field>
        <Field label={t("ml_licence")} isWide>
          <input id="mpLicence" name="licence" />
        </Field>
        <div className="mk-f wide">
          <div className="mk-checks">
            <label>
              <input type="checkbox" id="mpSharia" name="sharia" /> {t("ml_only_sharia")}
            </label>
          </div>
        </div>
        <div className="mk-actions wide">
          <button className="btn btn-primary" type="submit">
            {t("ml_publish")}
          </button>
          <Msg notice={notice} t={t} id="mlProdMsg" />
        </div>
      </form>
    </>
  );
}

type ProviderDeskProps = {
  t: Translate;
  leads: readonly Lead[];
  products: readonly FinanceProduct[];
  onOffer: (lead: Lead) => void;
  onSaved: () => void;
};

export function ProviderDesk({ t, leads, products, onOffer, onSaved }: ProviderDeskProps) {
  return (
    <div className="mk-box w12" id="mlProvider">
      <h3>{t("ml_provider_desk")}</h3>
      <div className="mk-stack">
        {leads.slice(0, MAX_LEADS).map(lead => (
          <LeadCard key={lead.id} lead={lead} t={t} onOffer={() => onOffer(lead)} />
        ))}
        {!leads.length && <Empty>{t("ml_no_leads")}</Empty>}
      </div>
      <h3 style={BOX_HEADING}>{t("ml_my_products")}</h3>
      <div className="mk-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} t={t} />
        ))}
        {!products.length && <Empty>{t("ml_no_products")}</Empty>}
      </div>
      <ProductForm t={t} onSaved={onSaved} />
    </div>
  );
}
