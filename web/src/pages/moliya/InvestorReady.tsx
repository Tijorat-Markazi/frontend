import { useState } from "react";
import type { ReactElement } from "react";
import { useI18n } from "../../shell/i18n";
import { askCopilot, companyIdentity, flag, listOf, record, text } from "../../shell/market";
import type { CopilotResult, DraftRow, Json, Translate } from "../../shell/market";
import { AI_HINT, AI_INPUT, AiOutput, NESTED_LIST } from "./parts";
import type { AiState } from "./parts";

const SMALL_INPUT = { ...AI_INPUT, padding: "9px 12px" };

/* Everything the model wrote is rendered as text, list by list. */
function listRow(items: readonly Json[], isOrdered: boolean, line: (item: Json) => ReactElement): ReactElement | null {
  if (!items.length) return null;
  const rows = items.map((item, index) => <li key={index}>{line(item)}</li>);
  return isOrdered ? <ol style={NESTED_LIST}>{rows}</ol> : <ul style={NESTED_LIST}>{rows}</ul>;
}

function listRows(data: Json, t: Translate): DraftRow[] {
  return [
    {
      label: t("ml_ir_deck"),
      value: listRow(listOf(data.deckOutline, record), true, slide => (
        <>
          <b>{text(slide.slide)}</b> — {text(slide.content)}
        </>
      )),
    },
    {
      label: t("ml_ir_risks"),
      value: listRow(listOf(data.riskRegister, record), false, risk => (
        <>
          [{text(risk.severity)}] <b>{text(risk.risk)}</b> — {text(risk.mitigation)}
        </>
      )),
    },
    {
      label: t("ml_ir_dataroom"),
      value: listRow(listOf(data.dataRoomChecklist, record), false, entry => (
        <>
          {flag(entry.required) && "★ "}
          {text(entry.item)}
        </>
      )),
    },
    {
      label: t("ml_ir_figures"),
      value: listRow(listOf(data.figures, record), false, figure => (
        <>
          {text(figure.label)}: <b>{text(figure.value)}</b>{" "}
          {/* An assumed figure is flagged; one taken from the text is not. */}
          <span className={text(figure.source) === "assumption" ? "mk-chip is-warn" : "mk-chip is-good"}>
            {text(figure.source)}
          </span>
        </>
      )),
    },
  ];
}

function packRows(result: CopilotResult, t: Translate): DraftRow[] {
  const teaser = record(result.data.teaser);
  return [
    { label: t("ml_ir_problem"), value: text(teaser.problem) },
    { label: t("ml_ir_solution"), value: text(teaser.solution) },
    { label: t("ml_ir_market"), value: text(teaser.market) },
    { label: t("ml_ask"), value: text(teaser.ask) },
    { label: t("ml_ir_use"), value: text(teaser.useOfFunds) },
    ...listRows(result.data, t),
  ];
}

/* AI Investor-Ready Studio: free text in, a teaser, deck outline, risk register and data-room list out. */
export function InvestorReady({ t }: { t: Translate }) {
  const { lang } = useI18n();
  const [about, setAbout] = useState("");
  const [ask, setAsk] = useState("");
  const [sector, setSector] = useState("");
  const [state, setState] = useState<AiState>({ status: "idle" });

  const draft = async (): Promise<void> => {
    const typed = about.trim();
    if (!typed) {
      setState({ status: "needInput" });
      return;
    }
    setState({ status: "loading" });
    const result = await askCopilot(
      companyIdentity.withCompany(
        companyIdentity.withPerson({ agent: "moliya.investor-ready", lang, text: typed, ask, sector }),
      ),
    );
    setState({ status: "done", result });
  };

  return (
    <div className="mk-ai">
      <h3>{t("ml_ir_title")}</h3>
      <p style={AI_HINT}>{t("ml_ir_hint")}</p>
      <textarea
        id="mlIrText"
        style={{ ...AI_INPUT, padding: "10px 12px", width: "100%", minHeight: 110 }}
        placeholder={t("ml_ir_ph")}
        value={about}
        onChange={event => setAbout(event.target.value)}
      />
      <div className="mk-row">
        <input
          id="mlIrAsk"
          type="number"
          placeholder={t("ml_ask")}
          style={{ ...SMALL_INPUT, maxWidth: 170 }}
          value={ask}
          onChange={event => setAsk(event.target.value)}
        />
        <input
          id="mlIrSector"
          placeholder={t("ml_f_sector")}
          style={{ ...SMALL_INPUT, maxWidth: 190 }}
          value={sector}
          onChange={event => setSector(event.target.value)}
        />
        <button className="btn btn-primary" type="button" id="mlIrGo" onClick={() => void draft()}>
          {t("ml_ir_go")}
        </button>
      </div>
      <AiOutput id="mlIrOut" state={state} needKey="ml_ir_need" t={t} rows={result => packRows(result, t)} />
    </div>
  );
}
