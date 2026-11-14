import type { Lang } from "@legacy/data.js";
import { useI18n } from "../../shell/i18n";
import {
  Drawer,
  Empty,
  formatMoney,
  formatNumber,
  KeyValues,
  listOf,
  Loading,
  marketJson,
  marketQuery,
  MatchCard,
  MatchTitle,
  Rail,
  useLoad,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { parseInvestorMatch } from "./capitalTypes";
import type { Project, Startup } from "./capitalTypes";
import { investorTypeLabel } from "./parts";
import { PROJECT_GATES } from "./types";

const MAX_MATCHES = 6;

type Rows = readonly (readonly [string, string])[];

function projectRows(project: Project, lang: Lang, t: Translate): Rows {
  const money = (value: number): string => (value ? formatMoney(value, project.currency, lang) : "");
  return [
    [t("ml_summary"), project.summary],
    ["CAPEX", money(project.capex)],
    ["OPEX", money(project.opex)],
    [t("ml_f_revenue"), money(project.revenue)],
    ["IRR", project.irr ? `${formatNumber(project.irr, lang, 1)}%` : ""],
    ["NPV", money(project.npv)],
    ["DSCR", project.dscr ? formatNumber(project.dscr, lang, 2) : ""],
    [t("ml_ask"), money(project.ask)],
    [t("ml_jobs"), project.jobs ? formatNumber(project.jobs, lang, 0) : ""],
    [t("ml_risks"), project.risks],
  ];
}

function startupRows(startup: Startup, lang: Lang, t: Translate): Rows {
  const money = (value: number): string => (value ? formatMoney(value, startup.currency, lang) : "");
  return [
    ["Pitch", startup.pitch],
    ["MRR", money(startup.mrr)],
    [t("ml_users"), startup.users ? formatNumber(startup.users, lang, 0) : ""],
    [t("ml_growth"), startup.growth ? `${formatNumber(startup.growth, lang, 1)}% / ${t("ml_month")}` : ""],
    ["Runway", startup.runway ? `${formatNumber(startup.runway, lang, 0)} ${t("ml_months")}` : ""],
    [t("ml_ask"), money(startup.ask)],
    [t("ml_valuation"), money(startup.valuation)],
    [t("ml_founders"), startup.founders.join(", ")],
  ];
}

type CapitalDrawerProps = { row: Project | Startup; t: Translate; onClose: () => void };

/* A project or a startup in full, with the investors whose mandate it fits. */
export function CapitalDrawer({ row, t, onClose }: CapitalDrawerProps) {
  const { lang } = useI18n();
  const url = `/api/moliya/match?${marketQuery({ kind: row.kind === "projects" ? "project" : "startup", id: row.id })}`;
  const matches = useLoad(url, async () => listOf((await marketJson(url)).matches, parseInvestorMatch));
  return (
    <Drawer title={row.name} onClose={onClose}>
      {matches.isLoading || !matches.data ? (
        <Loading />
      ) : (
        <>
          {row.kind === "projects" && <Rail steps={PROJECT_GATES} current={row.gate} />}
          <KeyValues rows={row.kind === "projects" ? projectRows(row, lang, t) : startupRows(row, lang, t)} />
          <h3 className="mk-h">{t("ml_investor_match")}</h3>
          <div className="mk-stack">
            {matches.data.slice(0, MAX_MATCHES).map((match, index) => (
              <MatchCard
                key={index}
                match={match}
                title={<MatchTitle name={match.investorName} by={investorTypeLabel(t)(match.investorType)} />}
              />
            ))}
            {!matches.data.length && <Empty>{t("ml_no_match")}</Empty>}
          </div>
          <p className="mk-note">{t("ml_match_note")}</p>
        </>
      )}
    </Drawer>
  );
}
