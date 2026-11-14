import type { ReactNode } from "react";
import { useI18n } from "../../shell/i18n";
import { activateOnKey, Chip, Chips, formatMoney, formatNumber } from "../../shell/market";
import type { Translate } from "../../shell/market";
import type { CapitalRow, Idea, Investor, Project, Startup } from "./capitalTypes";
import { ideaModelLabel, investorTypeLabel, PRICE } from "./parts";

const MAX_CARD_SECTORS = 4;

type OpenableProps = { id: string; onOpen: () => void; children: ReactNode };

function OpenableCard({ id, onOpen, children }: OpenableProps) {
  return (
    <article
      className="mk-card"
      data-cap={id}
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={activateOnKey(onOpen)}
    >
      {children}
    </article>
  );
}

function ProjectCard({ project, t, onOpen }: { project: Project; t: Translate; onOpen: () => void }) {
  const { lang } = useI18n();
  return (
    <OpenableCard id={project.id} onOpen={onOpen}>
      <div className="mk-chips">
        <Chip kind="accent">{project.gate}</Chip>
        {project.sector && <Chip kind="ghost">{project.sector}</Chip>}
      </div>
      <h3>{project.name}</h3>
      {project.summary && <p className="mk-desc">{project.summary}</p>}
      <div className="mk-meta">
        {project.capex > 0 && (
          <span>
            CAPEX <b>{formatMoney(project.capex, project.currency, lang)}</b>
          </span>
        )}
        {project.irr !== 0 && (
          <span>
            IRR <b>{formatNumber(project.irr, lang, 1)}%</b>
          </span>
        )}
        {project.jobs > 0 && (
          <span>
            {t("ml_jobs")} <b>{formatNumber(project.jobs, lang, 0)}</b>
          </span>
        )}
      </div>
      <div className="mk-card-foot">
        <span className="mk-price" style={PRICE}>
          {project.ask ? formatMoney(project.ask, project.currency, lang) : "—"}
        </span>
        <span className="mk-chip is-accent">
          {t("ml_readiness")} {formatNumber(project.readiness, lang, 0)}%
        </span>
      </div>
    </OpenableCard>
  );
}

function StartupCard({ startup, t, onOpen }: { startup: Startup; t: Translate; onOpen: () => void }) {
  const { lang } = useI18n();
  return (
    <OpenableCard id={startup.id} onOpen={onOpen}>
      <div className="mk-chips">
        <Chip kind="accent">{startup.stage}</Chip>
        {startup.sector && <Chip kind="ghost">{startup.sector}</Chip>}
      </div>
      <h3>{startup.name}</h3>
      {startup.pitch && <p className="mk-desc">{startup.pitch}</p>}
      <div className="mk-meta">
        {startup.mrr > 0 && (
          <span>
            MRR <b>{formatMoney(startup.mrr, startup.currency, lang)}</b>
          </span>
        )}
        {startup.users > 0 && (
          <span>
            {t("ml_users")} <b>{formatNumber(startup.users, lang, 0)}</b>
          </span>
        )}
        {startup.runway > 0 && (
          <span>
            Runway{" "}
            <b>
              {formatNumber(startup.runway, lang, 0)} {t("ml_months")}
            </b>
          </span>
        )}
      </div>
      <div className="mk-card-foot">
        <span className="mk-price" style={PRICE}>
          {startup.ask ? formatMoney(startup.ask, startup.currency, lang) : "—"}
        </span>
        {startup.valuation > 0 && (
          <span className="mk-chip is-ghost">
            {t("ml_valuation")} {formatMoney(startup.valuation, startup.currency, lang)}
          </span>
        )}
      </div>
    </OpenableCard>
  );
}

/* Investors are listed, not opened: their terms are discussed off the page. */
function InvestorCard({ investor, t }: { investor: Investor; t: Translate }) {
  const { lang } = useI18n();
  return (
    <article className="mk-card">
      <div className="mk-chips">
        <Chip kind="accent">{investorTypeLabel(t)(investor.type)}</Chip>
        {investor.isVerified && <Chip kind="good">{t("ml_verified")}</Chip>}
      </div>
      <h3>{investor.name}</h3>
      {investor.thesis && <p className="mk-desc">{investor.thesis}</p>}
      <Chips items={investor.sectors.slice(0, MAX_CARD_SECTORS)} kind="ghost" />
      <div className="mk-card-foot">
        <span className="mk-price" style={{ fontSize: 15 }}>
          {formatMoney(investor.ticketMin, "", lang)} – {formatMoney(investor.ticketMax, investor.currency, lang)}
        </span>
        <span className="mk-chip">{investor.stages.join(", ")}</span>
      </div>
    </article>
  );
}

function IdeaCard({ idea, t, onOpen }: { idea: Idea; t: Translate; onOpen: () => void }) {
  const { lang } = useI18n();
  return (
    <OpenableCard id={idea.id} onOpen={onOpen}>
      <div className="mk-chips">
        <Chip kind="accent">{ideaModelLabel(t)(idea.model)}</Chip>
        {idea.sector && <Chip kind="ghost">{idea.sector}</Chip>}
        {idea.ndaCount > 0 && <Chip kind="ghost">NDA {idea.ndaCount}</Chip>}
      </div>
      <h3>{idea.title}</h3>
      <p className="mk-desc">{idea.teaser}</p>
      <div className="mk-meta">
        <span>{idea.author}</span>
        {idea.ipStatus && <span>{idea.ipStatus}</span>}
      </div>
      <div className="mk-card-foot">
        <span className="mk-price" style={PRICE}>
          {idea.price ? formatMoney(idea.price, idea.currency, lang) : t("ml_negotiable")}
        </span>
        <span className="mk-chip is-warn">🔒 {t("ml_nda_gate")}</span>
      </div>
    </OpenableCard>
  );
}

export function CapitalCard({ row, t, onOpen }: { row: CapitalRow; t: Translate; onOpen: () => void }) {
  if (row.kind === "projects") return <ProjectCard project={row} t={t} onOpen={onOpen} />;
  if (row.kind === "startups") return <StartupCard startup={row} t={t} onOpen={onOpen} />;
  if (row.kind === "investors") return <InvestorCard investor={row} t={t} />;
  return <IdeaCard idea={row} t={t} onOpen={onOpen} />;
}
