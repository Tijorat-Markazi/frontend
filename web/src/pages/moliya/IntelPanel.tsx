import type { Lang } from "@legacy/data.js";
import { useI18n } from "../../shell/i18n";
import {
  amount,
  formatMoney,
  formatNumber,
  formatPercent,
  Kpi,
  listOf,
  Loading,
  marketJson,
  parseRank,
  Ranks,
  record,
  text,
  useKitText,
  useLoad,
} from "../../shell/market";
import type { Json, RankRow, Translate } from "../../shell/market";
import { categoryLabel } from "./parts";

function Headline({ headline, t }: { headline: Json; t: Translate }) {
  const { lang } = useI18n();
  const count = (value: unknown): string => formatNumber(value, lang, 0);
  const stale = amount(headline.staleProducts);
  return (
    <div className="mk-kpis" style={{ marginBottom: "var(--mk-gap)" }}>
      <Kpi
        value={formatMoney(headline.capitalProgressed, "", lang)}
        label={t("ml_k_progressed")}
        isHero
        note={t("ml_k_northstar")}
      />
      <Kpi value={count(headline.providers)} label={t("ml_k_providers")} />
      <Kpi value={count(headline.products)} label={t("ml_k_products")} note={stale ? `${stale} ${t("ml_stale")}` : ""} />
      <Kpi value={count(headline.investors)} label={t("ml_k_investors")} />
      <Kpi value={count(headline.requests)} label={t("ml_k_requests")} />
      <Kpi value={formatPercent(headline.fundingGapPct, lang)} label={t("ml_k_gap")} />
    </div>
  );
}

/** How many of a sector's requests were answered, and the gap that leaves. */
function demandRow(value: unknown): RankRow {
  const row = record(value);
  const requests = amount(row.requests);
  return {
    label: text(row.label),
    value: requests,
    display: `${amount(row.answered)}/${requests} · ${amount(row.gap)}% gap`,
  };
}

type TermRow = { label: string; suffix: string; stats: Json };

/* Quartiles only: a single provider's terms are never shown. */
function TermsTable({ monitor, t }: { monitor: Json; t: Translate }) {
  const { lang } = useI18n();
  const kit = useKitText();
  const rows: TermRow[] = [
    { label: t("ml_rate"), suffix: "%", stats: record(monitor.ratePct) },
    { label: t("ml_fee"), suffix: "%", stats: record(monitor.feePct) },
    { label: t("ml_months"), suffix: "", stats: record(monitor.tenor) },
  ].filter(row => Object.keys(row.stats).length > 0);
  if (!rows.length) return <p className="mk-loading">{kit("mk_nodata")}</p>;
  const cell = (row: TermRow, key: string): string => formatNumber(row.stats[key], lang, 2) + row.suffix;
  return (
    <div className="mk-tablewrap">
      <table className="mk-table" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            <th />
            <th className="num">P25</th>
            <th className="num">{t("ml_median")}</th>
            <th className="num">P75</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="num">{cell(row, "p25")}</td>
              <td className="num">{cell(row, "median")}</td>
              <td className="num">{cell(row, "p75")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({ gates, lang, t }: { gates: readonly Json[]; lang: Lang; t: Translate }) {
  return (
    <div className="mk-box w12">
      <h3>{t("ml_pgo_pipeline")}</h3>
      <div className="mk-funnel">
        {gates.map((gate, index) => (
          <div key={index}>
            <b>{formatNumber(gate.n, lang, 0)}</b>
            <span>{text(gate.gate)}</span>
          </div>
        ))}
      </div>
      <p className="mk-note">{gates.map(gate => `${text(gate.gate)} ${text(gate.label)}`).join(" · ")}</p>
    </div>
  );
}

function IntelBody({ intel, t }: { intel: Json; t: Translate }) {
  const { lang } = useI18n();
  const monitor = record(intel.termsMonitor);
  const ideas = record(intel.ideaExchange);
  const supply = listOf(record(intel.supply).byCategory, parseRank).map(row => ({
    ...row,
    label: categoryLabel(t)(row.label),
  }));
  return (
    <>
      <Headline headline={record(intel.headline)} t={t} />
      <div className="mk-bento">
        <div className="mk-box w6 is-lead">
          <h3>{t("ml_demand_sector")}</h3>
          <Ranks rows={listOf(record(intel.demandMap).bySector, demandRow)} limit={8} />
        </div>
        <div className="mk-box w6">
          <h3>{t("ml_terms_monitor")}</h3>
          <TermsTable monitor={monitor} t={t} />
          {text(monitor.note) && <p className="mk-note">{text(monitor.note)}</p>}
        </div>
        <Pipeline gates={listOf(intel.projectPipeline, record)} lang={lang} t={t} />
        <div className="mk-box w4">
          <h3>{t("ml_appetite")}</h3>
          <Ranks rows={listOf(record(intel.investorAppetite).bySector, parseRank)} limit={7} />
        </div>
        <div className="mk-box w4">
          <h3>{t("ml_supply_cat")}</h3>
          <Ranks rows={supply} limit={7} />
        </div>
        <div className="mk-box w4">
          <h3>{t("ml_startup_pulse")}</h3>
          <Ranks rows={listOf(record(intel.startupPulse).byStage, parseRank)} limit={6} />
          <p className="mk-note">
            {t("ml_idea_conv")}: {formatPercent(ideas.conversion, lang)} · NDA {formatNumber(ideas.ndas, lang, 0)}
          </p>
        </div>
        <div className="mk-box w12">
          <p className="mk-note">{text(intel.privacy)}</p>
        </div>
      </div>
    </>
  );
}

/* Capital Intelligence: aggregates only, never one company's or investor's own terms. */
export function IntelPanel({ t }: { t: Translate }) {
  const intel = useLoad("intel", () => marketJson("/api/moliya/intel"));
  return (
    <>
      <p className="mk-sub">{t("ml_intel_sub")}</p>
      <div id="mlIntel">{intel.data ? <IntelBody intel={intel.data} t={t} /> : <Loading />}</div>
    </>
  );
}
