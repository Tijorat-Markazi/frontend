import { useState } from "react";
import type { Lang } from "@legacy/data.js";
import { useI18n } from "../../shell/i18n";
import { amount, askCopilot, companyIdentity, flag, formatMoney, text, texts } from "../../shell/market";
import type { CopilotResult, DraftRow, Translate } from "../../shell/market";
import { AI_HINT, AI_INPUT, AiOutput, categoryLabel } from "./parts";
import type { AiState } from "./parts";
import { REQUEST_CURRENCIES } from "./types";

/** What the finder read out of the sentence; blank fields leave a filter as it was. */
export type FoundNeed = { amount: string; tenor: string; currency: string; category: string; isSharia: boolean };

function draftRows(result: CopilotResult, lang: Lang, t: Translate): DraftRow[] {
  const data = result.data;
  const sum = amount(data.amount);
  const months = amount(data.tenor);
  return [
    { label: t("ml_f_amount"), value: sum ? formatMoney(sum, text(data.currency), lang) : "" },
    { label: t("ml_f_tenor"), value: months ? `${months} ${t("ml_months")}` : "" },
    { label: t("ml_f_purpose"), value: text(data.purpose) },
    { label: t("ml_f_category"), value: text(data.category) && categoryLabel(t)(text(data.category)) },
    { label: t("ml_instrument"), value: texts(data.instruments).join(", ") },
    { label: t("ml_why_these"), value: texts(data.whyThese).join(" · ") },
    { label: t("ml_docs"), value: texts(data.documentsLikelyNeeded).join(", ") },
  ];
}

function foundNeed(result: CopilotResult): FoundNeed {
  const data = result.data;
  const currency = text(data.currency);
  return {
    amount: amount(data.amount) ? String(amount(data.amount)) : "",
    tenor: amount(data.tenor) ? String(amount(data.tenor)) : "",
    /* A currency the filter does not offer would leave its list showing nothing. */
    currency: REQUEST_CURRENCIES.some(code => code === currency) ? currency : "",
    category: text(data.category),
    isSharia: flag(data.sharia),
  };
}

/* Smart Finance Finder: a plain sentence becomes a structured query, which then sets the filters. */
export function FinanceFinder({ t, onFound }: { t: Translate; onFound: (need: FoundNeed) => void }) {
  const { lang } = useI18n();
  const [sentence, setSentence] = useState("");
  const [state, setState] = useState<AiState>({ status: "idle" });

  const analyse = async (): Promise<void> => {
    const typed = sentence.trim();
    if (!typed) {
      setState({ status: "needInput" });
      return;
    }
    setState({ status: "loading" });
    const result = await askCopilot(
      companyIdentity.withCompany(companyIdentity.withPerson({ agent: "moliya.finance-need", lang, text: typed })),
    );
    setState({ status: "done", result });
    if (result.ok) onFound(foundNeed(result));
  };

  return (
    <div className="mk-ai" style={{ marginBottom: "var(--mk-gap)" }}>
      <h3>{t("ml_finder")}</h3>
      <p style={AI_HINT}>{t("ml_finder_hint")}</p>
      <div className="mk-row">
        <input
          type="text"
          id="mlNl"
          style={{ ...AI_INPUT, flex: "1 1 320px" }}
          placeholder={t("ml_finder_ph")}
          value={sentence}
          onChange={event => setSentence(event.target.value)}
        />
        <button className="btn btn-primary" type="button" id="mlNlGo" onClick={() => void analyse()}>
          {t("ml_finder_go")}
        </button>
      </div>
      <AiOutput id="mlNlOut" state={state} needKey="ml_finder_need" t={t} rows={result => draftRows(result, lang, t)} />
    </div>
  );
}
