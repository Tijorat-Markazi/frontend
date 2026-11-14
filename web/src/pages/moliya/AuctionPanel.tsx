import { useState } from "react";
import { useI18n } from "../../shell/i18n";
import {
  activateOnKey,
  Chip,
  Empty,
  formatDay,
  formatMoney,
  formatNumber,
  listOf,
  Loading,
  marketJson,
  MatchCard,
  MatchTitle,
  useLoad,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { categoryLabel, statusLabel } from "./parts";
import { RequestDrawer } from "./RequestDrawer";
import { RequestForm } from "./RequestForm";
import type { RequestPrefill } from "./RequestForm";
import { parseRequest } from "./types";
import type { FundingRequest, ProductMatch } from "./types";

const STATUS_KIND: Readonly<Record<string, string>> = {
  open: "good",
  offers: "accent",
  shortlisted: "warn",
  underwriting: "warn",
  closed: "ghost",
};
const MAX_INSTANT_MATCHES = 5;

function RequestCard({ request, t, onOpen }: { request: FundingRequest; t: Translate; onOpen: () => void }) {
  const { lang } = useI18n();
  return (
    <article
      className="mk-card"
      data-req={request.id}
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={activateOnKey(onOpen)}
    >
      <div className="mk-chips">
        <Chip kind={STATUS_KIND[request.status] ?? "ghost"}>{statusLabel(t)(request.status)}</Chip>
        {request.category && <Chip kind="ghost">{categoryLabel(t)(request.category)}</Chip>}
        {request.isSharia && <Chip kind="good">{t("ml_sharia_badge")}</Chip>}
      </div>
      <h3>{formatMoney(request.amount, request.currency, lang)}</h3>
      {request.purpose && <p className="mk-desc">{request.purpose}</p>}
      <div className="mk-meta">
        <span>{request.ownerName}</span>
        {request.tenor > 0 && (
          <span>
            <b>
              {formatNumber(request.tenor, lang, 0)} {t("ml_months")}
            </b>
          </span>
        )}
        {request.sector && <span>{request.sector}</span>}
        {request.region && <span>📍 {request.region}</span>}
      </div>
      <div className="mk-card-foot">
        <span className="mk-chip is-accent">
          {t("ml_offers")}: {formatNumber(request.offerCount, lang, 0)}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{formatDay(request.created, lang)}</span>
      </div>
    </article>
  );
}

function RoutedProducts({ matches, t }: { matches: readonly ProductMatch[]; t: Translate }) {
  if (!matches.length) return null;
  return (
    <div className="mk-box w12">
      <h3>{t("ml_routed")}</h3>
      <div className="mk-stack">
        {matches.slice(0, MAX_INSTANT_MATCHES).map((match, index) => (
          <MatchCard key={index} match={match} title={<MatchTitle name={match.productName} by={match.providerName} />} />
        ))}
      </div>
    </div>
  );
}

type AuctionPanelProps = {
  t: Translate;
  categories: readonly string[];
  prefill: RequestPrefill | null;
  canOffer: boolean;
  /** Changes whenever a request or an offer was added anywhere on the page. */
  stamp: number;
  onChanged: () => void;
};

/* The reverse auction: open funding requests on the left, a new request on the right. */
export function AuctionPanel({ t, categories, prefill, canOffer, stamp, onChanged }: AuctionPanelProps) {
  const { lang } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const [routed, setRouted] = useState<ProductMatch[]>([]);
  const requests = useLoad(`requests|${stamp}`, async () =>
    listOf((await marketJson("/api/moliya/requests")).items, parseRequest),
  );
  const items = requests.data ?? [];

  return (
    <>
      <p className="mk-sub">{t("ml_auction_sub")}</p>
      <div className="mk-split">
        <div className="mk-stack">
          <div className="mk-row">
            <span className="mk-count" id="mlReqCount">
              {requests.data && t("ml_req_count").replace("{n}", formatNumber(items.length, lang, 0))}
            </span>
          </div>
          <div className="mk-grid" id="mlReqGrid">
            {requests.isLoading && <Loading />}
            {!requests.isLoading && !items.length && <Empty>{t("ml_req_empty")}</Empty>}
            {!requests.isLoading &&
              items.map(request => (
                <RequestCard key={request.id} request={request} t={t} onOpen={() => setOpenId(request.id)} />
              ))}
          </div>
        </div>
        <aside className="mk-stack" id="request">
          <RequestForm
            t={t}
            categories={categories}
            prefill={prefill}
            onPublished={matches => {
              setRouted(matches);
              onChanged();
            }}
          />
          <div id="mlReqMatches">
            <RoutedProducts matches={routed} t={t} />
          </div>
        </aside>
      </div>
      {openId !== null && (
        <RequestDrawer
          id={openId}
          t={t}
          canOffer={canOffer}
          onClose={() => setOpenId(null)}
          onOfferSent={onChanged}
        />
      )}
    </>
  );
}
