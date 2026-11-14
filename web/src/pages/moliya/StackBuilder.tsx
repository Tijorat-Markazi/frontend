import { useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "../../shell/i18n";
import {
  Field,
  formatMoney,
  formatNumber,
  formValues,
  listOf,
  Loading,
  marketJson,
  OptionSelect,
  Ranks,
  text,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { CAPITAL_CURRENCIES, parseScenario } from "./types";
import type { StackScenario } from "./types";

const MAX_SOURCES = 8;
const FLAGS = ["collateral", "exporter", "equipment", "sharia"] as const;

type Built = { scenarios: StackScenario[]; currency: string; disclaimer: string };
type StackState = { status: "idle" } | { status: "loading" } | { status: "failed" } | { status: "done"; built: Built };

function Scenario({ scenario, currency, t }: { scenario: StackScenario; currency: string; t: Translate }) {
  const { lang } = useI18n();
  return (
    <div className="mk-card" style={{ gap: 9 }}>
      <h3>{scenario.name}</h3>
      <div className="mk-meta">
        <span>
          {t("ml_cost")} <b>{scenario.costOfCapital}</b>
        </span>
        <span>
          {t("ml_dilution")} <b>{formatNumber(scenario.dilution, lang, 0)}%</b>
        </span>
      </div>
      <Ranks
        limit={MAX_SOURCES}
        rows={scenario.sources.map(source => ({
          label: `${source.label} — ${formatMoney(source.amount, currency, lang)}`,
          value: source.pct,
          display: `${formatNumber(source.pct, lang, 0)}%`,
        }))}
      />
      <p style={{ fontSize: 13, color: "var(--muted)" }}>{scenario.note}</p>
    </div>
  );
}

/* Capital Stack Builder: three financing scenarios from cash flow, collateral and asset type.
   The figures typed here are not tied to anyone, so the request carries no identity. */
export function StackBuilder({ t }: { t: Translate }) {
  const [state, setState] = useState<StackState>({ status: "idle" });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const fields = formValues(event.currentTarget);
    setState({ status: "loading" });
    const ticked = Object.fromEntries(FLAGS.map(name => [name, fields[name] !== undefined]));
    const answer = await marketJson("/api/moliya/capital-stack", { ...fields, ...ticked });
    if (!answer.ok) {
      setState({ status: "failed" });
      return;
    }
    const built = {
      scenarios: listOf(answer.scenarios, parseScenario),
      currency: text(answer.currency),
      disclaimer: text(answer.disclaimer),
    };
    setState({ status: "done", built });
  };

  return (
    <>
      <h3>{t("ml_stack")}</h3>
      <p className="mk-note" style={{ marginBottom: 12 }}>
        {t("ml_stack_hint")}
      </p>
      <form className="mk-form" id="mlStackForm" onSubmit={handleSubmit}>
        <Field label={t("ml_f_amount")}>
          <input id="csAmount" name="amount" type="number" required />
        </Field>
        <Field label={t("ml_f_currency")}>
          <OptionSelect id="csCurrency" name="currency" options={CAPITAL_CURRENCIES} />
        </Field>
        <Field label="EBITDA">
          <input id="csEbitda" name="ebitda" type="number" />
        </Field>
        <Field label={t("ml_receivables")}>
          <input id="csReceivables" name="receivables" type="number" />
        </Field>
        <div className="mk-f wide">
          <div className="mk-checks">
            <label>
              <input type="checkbox" id="csCollateral" name="collateral" /> {t("ml_has_collateral")}
            </label>
            <label>
              <input type="checkbox" id="csExporter" name="exporter" /> {t("ml_is_exporter")}
            </label>
            <label>
              <input type="checkbox" id="csEquipment" name="equipment" /> {t("ml_buys_equipment")}
            </label>
            <label>
              <input type="checkbox" id="csSharia" name="sharia" /> {t("ml_only_sharia")}
            </label>
          </div>
        </div>
        <div className="mk-actions wide">
          <button className="btn btn-primary" type="submit">
            {t("ml_stack_go")}
          </button>
        </div>
      </form>
      <div id="mlStackOut" className={state.status === "failed" ? "mk-msg is-err" : undefined}>
        {state.status === "loading" && <Loading />}
        {state.status === "failed" && t("ml_stack_fail")}
        {state.status === "done" && (
          <>
            <div className="mk-stack" style={{ marginTop: 12 }}>
              {state.built.scenarios.map((scenario, index) => (
                <Scenario key={index} scenario={scenario} currency={state.built.currency} t={t} />
              ))}
            </div>
            <p className="mk-note" style={{ marginTop: 10 }}>
              {state.built.disclaimer}
            </p>
          </>
        )}
      </div>
    </>
  );
}
