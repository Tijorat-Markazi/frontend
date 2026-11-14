import { useState } from "react";
import { useI18n } from "../../shell/i18n";
import {
  Chip,
  companyIdentity,
  Empty,
  formatMoney,
  formatNumber,
  listOf,
  Loading,
  marketJson,
  Meters,
  useLoad,
} from "../../shell/market";
import type { Json, Notice, Translate } from "../../shell/market";
import { IdentityBar } from "./IdentityBar";
import { InvestorReady } from "./InvestorReady";
import { OfferDrawer } from "./OfferDrawer";
import { statusLabel } from "./parts";
import { PassportForm } from "./PassportForm";
import { ProviderDesk } from "./ProviderDesk";
import { RequestDrawer } from "./RequestDrawer";
import { StackBuilder } from "./StackBuilder";
import { parseLead, parsePassport, parseProduct, parseReadiness, parseRequest } from "./types";
import type { FinanceProduct, FundingRequest, Lead, OfferTarget, Passport, Readiness } from "./types";
import type { Visitor } from "./visitor";

type Cabinet = {
  /** Whose cabinet this is, so one visitor's answer is never shown to the next. */
  owner: string;
  passport: Passport | null;
  readiness: Readiness | null;
  requests: FundingRequest[];
  /** Null unless the server recognised a company session. */
  desk: { leads: Lead[]; products: FinanceProduct[] } | null;
};

const NOTHING: Json = {};

/* A visitor without an e-mail has no passport or requests to ask for, and
   only a company has a provider desk: those calls are simply not made. */
async function loadCabinet(owner: string, hasEmail: boolean, hasCompany: boolean): Promise<Cabinet> {
  const { withCompany, withPerson } = companyIdentity;
  const [passport, mine, provider] = await Promise.all([
    hasEmail ? marketJson("/api/moliya/passport", withPerson({ op: "get" })) : NOTHING,
    hasEmail ? marketJson("/api/moliya/request/mine", withCompany(withPerson({}))) : NOTHING,
    hasCompany ? marketJson("/api/moliya/provider", withCompany({})) : NOTHING,
  ]);
  return {
    owner,
    passport: parsePassport(passport.passport),
    readiness: parseReadiness(passport.readiness),
    requests: listOf(mine.items, parseRequest),
    desk: provider.ok
      ? { leads: listOf(provider.leads, parseLead), products: listOf(provider.products, parseProduct) }
      : null,
  };
}

function ReadinessBox({ readiness, t }: { readiness: Readiness | null; t: Translate }) {
  const { lang } = useI18n();
  return (
    <div className="mk-box w6 is-lead">
      <h3>{t("ml_passport")}</h3>
      {readiness ? (
        <>
          <div className="mk-score-big">
            <b>{formatNumber(readiness.score, lang, 0)}</b>
            <span>/ 100</span>
          </div>
          <Meters blocks={readiness.blocks} />
          <p className="mk-note">{readiness.note}</p>
        </>
      ) : (
        <Empty>{t("ml_no_passport")}</Empty>
      )}
    </div>
  );
}

type MyRequestsProps = { requests: readonly FundingRequest[]; t: Translate; onOpen: (id: string) => void };

function MyRequests({ requests, t, onOpen }: MyRequestsProps) {
  const { lang } = useI18n();
  return (
    <div className="mk-box w6">
      <h3>{t("ml_my_requests")}</h3>
      <div className="mk-stack">
        {requests.map(request => (
          <div className="mk-card" style={{ gap: 7 }} key={request.id}>
            <div className="mk-chips">
              <Chip kind="accent">{statusLabel(t)(request.status)}</Chip>
            </div>
            <h3>{formatMoney(request.amount, request.currency, lang)}</h3>
            <div className="mk-meta">
              <span>{request.purpose}</span>
              <span className="mk-chip">
                {t("ml_offers")}: {formatNumber(request.offerCount, lang, 0)}
              </span>
            </div>
            <div className="mk-actions">
              <button
                className="btn btn-ghost"
                type="button"
                data-openreq={request.id}
                onClick={() => onOpen(request.id)}
              >
                {t("ml_open")}
              </button>
            </div>
          </div>
        ))}
        {!requests.length && <Empty>{t("ml_no_requests")}</Empty>}
      </div>
    </div>
  );
}

type Opened = { kind: "request"; id: string } | { kind: "offer"; target: OfferTarget } | null;

type CabinetPanelProps = { t: Translate; visitor: Visitor; onRequestsChanged: () => void };

/* The cabinet: the Funding Passport and its readiness, own requests, the two
   builders and, for a company, the provider desk. */
export function CabinetPanel({ t, visitor, onRequestsChanged }: CabinetPanelProps) {
  const { company, email } = visitor;
  const owner = `${email}|${company?.id ?? ""}`;
  const cabinet = useLoad(owner, () => loadCabinet(owner, email !== "", company !== null));
  const [opened, setOpened] = useState<Opened>(null);
  const [passportNotice, setPassportNotice] = useState<Notice | null>(null);
  const loaded = cabinet.data?.owner === owner ? cabinet.data : null;
  const close = (): void => setOpened(null);
  const reload = (): void => {
    visitor.refresh();
    cabinet.reload();
  };

  return (
    <>
      <IdentityBar key={company?.id ?? "guest"} t={t} visitor={visitor} />
      <div id="mlCabinet">
        {!loaded && <Loading />}
        {loaded && (
          <div className="mk-bento">
            <ReadinessBox readiness={loaded.readiness} t={t} />
            <MyRequests requests={loaded.requests} t={t} onOpen={id => setOpened({ kind: "request", id })} />
            <div className="mk-box w6">
              <PassportForm
                /* Rebuilt from what the server stored, as each save answers with it. */
                key={JSON.stringify(loaded.passport)}
                t={t}
                passport={loaded.passport}
                notice={passportNotice}
                onNotice={setPassportNotice}
                onSaved={reload}
              />
            </div>
            <div className="mk-box w6">
              <StackBuilder t={t} />
            </div>
            <div className="mk-box w12">
              <InvestorReady t={t} />
            </div>
            {loaded.desk && (
              <ProviderDesk
                t={t}
                leads={loaded.desk.leads}
                products={loaded.desk.products}
                onOffer={lead => setOpened({ kind: "offer", target: lead })}
                onSaved={cabinet.reload}
              />
            )}
          </div>
        )}
      </div>
      {opened?.kind === "request" && (
        <RequestDrawer
          id={opened.id}
          t={t}
          canOffer={company !== null}
          onClose={close}
          onOfferSent={onRequestsChanged}
        />
      )}
      {opened?.kind === "offer" && (
        <OfferDrawer target={opened.target} t={t} onClose={close} onSent={onRequestsChanged} />
      )}
    </>
  );
}
