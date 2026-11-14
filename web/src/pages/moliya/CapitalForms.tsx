/*
 * The publish form under each capital-market list. Field names are the keys
 * of the request body, so the body is the form read as it stands.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import {
  checkedValues,
  companyIdentity,
  Field,
  formValues,
  marketJson,
  Msg,
  OptionSelect,
} from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import type { CapitalSegment } from "./capitalTypes";
import { ideaModelLabel, investorTypeLabel } from "./parts";
import {
  CAPITAL_CURRENCIES,
  IDEA_MODELS,
  INSTRUMENTS,
  INVESTOR_STAGES,
  INVESTOR_TYPES,
  SHORT_CURRENCIES,
  STARTUP_STAGES,
} from "./types";

const SAVE_PATHS: Readonly<Record<CapitalSegment, string>> = {
  projects: "/api/moliya/project",
  startups: "/api/moliya/startup",
  investors: "/api/moliya/investor",
  ideas: "/api/moliya/idea",
};

type InputProps = { id: string; name: string; label: string; type?: "number" };

function Input({ id, name, label, type }: InputProps) {
  return (
    <Field label={label}>
      <input id={id} name={name} type={type} />
    </Field>
  );
}

function Area({ id, name, label }: InputProps) {
  return (
    <Field label={label} isWide>
      <textarea id={id} name={name} />
    </Field>
  );
}

function ProjectFields({ t }: { t: Translate }) {
  return (
    <>
      <Input id="cpName" name="name" label={t("ml_f_name")} />
      <Input id="cpSector" name="sector" label={t("ml_f_sector")} />
      <Input id="cpRegion" name="region" label={t("ml_f_region")} />
      <Area id="cpSummary" name="summary" label={t("ml_summary")} />
      <Input id="cpCapex" name="capex" label="CAPEX" type="number" />
      <Input id="cpOpex" name="opex" label="OPEX" type="number" />
      <Input id="cpRevenue" name="revenue" label={t("ml_f_revenue")} type="number" />
      <Field label={t("ml_f_currency")}>
        <OptionSelect id="cpCurrency" name="currency" options={CAPITAL_CURRENCIES} />
      </Field>
      <Input id="cpIrr" name="irr" label="IRR %" type="number" />
      <Input id="cpNpv" name="npv" label="NPV" type="number" />
      <Input id="cpDscr" name="dscr" label="DSCR" type="number" />
      <Input id="cpAsk" name="ask" label={t("ml_ask")} type="number" />
      <Input id="cpJobs" name="jobs" label={t("ml_jobs")} type="number" />
      <Area id="cpRisks" name="risks" label={t("ml_risks")} />
    </>
  );
}

function StartupFields({ t }: { t: Translate }) {
  return (
    <>
      <Input id="suName" name="name" label={t("ml_f_name")} />
      <Field label={t("ml_stage")}>
        <OptionSelect id="suStage" name="stage" options={STARTUP_STAGES} />
      </Field>
      <Input id="suSector" name="sector" label={t("ml_f_sector")} />
      <Input id="suRegion" name="region" label={t("ml_f_region")} />
      <Area id="suPitch" name="pitch" label="Pitch" />
      <Input id="suMrr" name="mrr" label="MRR" type="number" />
      <Input id="suUsers" name="users" label={t("ml_users")} type="number" />
      <Input id="suGrowth" name="growth" label={`${t("ml_growth")} %`} type="number" />
      <Input id="suRunway" name="runway" label={`Runway (${t("ml_months")})`} type="number" />
      <Input id="suAsk" name="ask" label={t("ml_ask")} type="number" />
      <Field label={t("ml_f_currency")}>
        <OptionSelect id="suCurrency" name="currency" options={SHORT_CURRENCIES} />
      </Field>
      <Input id="suValuation" name="valuation" label={t("ml_valuation")} type="number" />
      <Input id="suDeck" name="deck" label="Deck URL" />
    </>
  );
}

type CheckGroupProps = { label: string; name: string; className: string; options: readonly string[] };

function CheckGroup({ label, name, className, options }: CheckGroupProps) {
  return (
    <Field label={label} isWide>
      <div className="mk-checks">
        {options.map(option => (
          <label key={option}>
            <input type="checkbox" className={className} name={name} value={option} /> {option}
          </label>
        ))}
      </div>
    </Field>
  );
}

function InvestorFields({ t }: { t: Translate }) {
  return (
    <>
      <Input id="ivName" name="name" label={t("ml_f_name")} />
      <Field label={t("ml_inv_type")}>
        <OptionSelect id="ivType" name="type" options={INVESTOR_TYPES} labelOf={investorTypeLabel(t)} />
      </Field>
      <Input id="ivMin" name="ticketMin" label={t("ml_ticket_min")} type="number" />
      <Input id="ivMax" name="ticketMax" label={t("ml_ticket_max")} type="number" />
      <Field label={t("ml_f_currency")}>
        <OptionSelect id="ivCurrency" name="currency" options={CAPITAL_CURRENCIES} />
      </Field>
      <Input id="ivSectors" name="sectors" label={t("ml_sectors")} />
      <Input id="ivGeos" name="geos" label={t("ml_geos")} />
      <CheckGroup label={t("ml_stage")} name="stages" className="ivStage" options={INVESTOR_STAGES} />
      <CheckGroup label={t("ml_instrument")} name="instruments" className="ivInstr" options={INSTRUMENTS} />
      <Area id="ivThesis" name="thesis" label={t("ml_thesis")} />
    </>
  );
}

function IdeaFields({ t }: { t: Translate }) {
  return (
    <>
      <Input id="idTitle" name="title" label={t("ml_f_title")} />
      <Input id="idSector" name="sector" label={t("ml_f_sector")} />
      <Area id="idTeaser" name="teaser" label={t("ml_teaser")} />
      <Area id="idConfidential" name="confidential" label={`${t("ml_confidential")} (NDA)`} />
      <Field label={t("ml_model")}>
        <OptionSelect id="idModel" name="model" options={IDEA_MODELS} labelOf={ideaModelLabel(t)} />
      </Field>
      <Input id="idPrice" name="price" label={t("ml_price")} type="number" />
      <Field label={t("ml_f_currency")}>
        <OptionSelect id="idCurrency" name="currency" options={SHORT_CURRENCIES} />
      </Field>
      <Input id="idIp" name="ipStatus" label="IP status" />
      <Area id="idTerms" name="terms" label={t("ml_terms")} />
    </>
  );
}

function bodyOf(form: HTMLFormElement, segment: CapitalSegment): Record<string, string | string[]> {
  const fields = formValues(form);
  if (segment !== "investors") return fields;
  /* Unticked groups must still be sent as empty lists, not left out. */
  return { ...fields, stages: checkedValues(form, "stages"), instruments: checkedValues(form, "instruments") };
}

type CapitalFormProps = { segment: CapitalSegment; t: Translate; onSaved: () => void };

export function CapitalForm({ segment, t, onSaved }: CapitalFormProps) {
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    /* As moliya-forms.js sends it: the person's name replaces the form's own "name" field
       (project, startup, investor). Production behaves so, and the port does not change what is stored. */
    const body = companyIdentity.withCompany(companyIdentity.withPerson(bodyOf(form, segment)));
    const answer = await marketJson(SAVE_PATHS[segment], body);
    if (!answer.ok) {
      setNotice({ key: answer.error === "identify_first" ? "ml_need_email" : "ml_save_fail", kind: "err" });
      return;
    }
    setNotice({ key: "ml_save_ok", kind: "ok" });
    form.reset();
    onSaved();
  };

  return (
    <>
      <h3>{t(`ml_publish_${segment}`)}</h3>
      <p className="mk-note" style={{ marginBottom: 12 }}>
        {t("ml_publish_hint")}
      </p>
      <form className="mk-form" id="mlCapF" onSubmit={handleSubmit}>
        {segment === "projects" && <ProjectFields t={t} />}
        {segment === "startups" && <StartupFields t={t} />}
        {segment === "investors" && <InvestorFields t={t} />}
        {segment === "ideas" && <IdeaFields t={t} />}
        <div className="mk-actions wide">
          <button className="btn btn-primary" type="submit">
            {t("ml_publish")}
          </button>
          <Msg notice={notice} t={t} id="mlCapMsg" />
        </div>
        {segment === "ideas" && <p className="mk-note wide">{t("ml_idea_publish_note")}</p>}
      </form>
    </>
  );
}
