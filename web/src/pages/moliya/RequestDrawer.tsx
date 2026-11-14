import { useState } from "react";
import { useI18n } from "../../shell/i18n";
import {
  Chip,
  Drawer,
  Empty,
  formatDay,
  formatMoney,
  formatNumber,
  KeyValues,
  listOf,
  Loading,
  marketJson,
  marketQuery,
  MatchCard,
  MatchTitle,
  text,
  useLoad,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { OfferDrawer } from "./OfferDrawer";
import { statusLabel } from "./parts";
import { parseOffer, parseProductMatch, parseRequest } from "./types";
import type { FundingRequest, Offer, ProductMatch } from "./types";

const MAX_MATCHES = 6;

type Comparison = { offers: Offer[]; method: string; disclaimer: string };
type RequestDetail = { request: FundingRequest; matches: ProductMatch[]; comparison: Comparison } | null;

/* The offers answer only to the request's owner; anyone else gets none, not an error. */
async function loadDetail(id: string): Promise<RequestDetail> {
  const [matched, offered] = await Promise.all([
    marketJson(`/api/moliya/request/matches?${marketQuery({ id })}`),
    marketJson(`/api/moliya/offers?${marketQuery({ requestId: id })}`),
  ]);
  if (matched.error) return null;
  return {
    request: parseRequest(matched.request),
    matches: listOf(matched.matches, parseProductMatch),
    comparison: {
      offers: listOf(offered.offers, parseOffer),
      method: text(offered.method),
      disclaimer: text(offered.disclaimer),
    },
  };
}

/* Every offer on one methodology, so the all-in cost is what gets compared. */
function OfferTable({ comparison, t }: { comparison: Comparison; t: Translate }) {
  const { lang } = useI18n();
  const percent = (value: number): string => `${formatNumber(value, lang, 2)}%`;
  return (
    <>
      <h3 className="mk-h">{t("ml_offer_compare")}</h3>
      <div className="mk-tablewrap">
        <table className="mk-table">
          <thead>
            <tr>
              <th>{t("ml_provider")}</th>
              <th className="num">{t("ml_rate")}</th>
              <th className="num">{t("ml_fee")}</th>
              <th className="num">{t("ml_months")}</th>
              <th className="num">All-in</th>
              <th>{t("ml_validity")}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.offers.map((offer, index) => (
              <tr className={offer.isBestCost ? "is-best" : ""} key={`${offer.providerName}|${index}`}>
                <td>{offer.providerName}</td>
                <td className="num">{percent(offer.ratePct)}</td>
                <td className="num">{percent(offer.feePct)}</td>
                <td className="num">{formatNumber(offer.tenor, lang, 0)}</td>
                <td className="num">
                  <b>{percent(offer.allInPct)}</b>
                  {offer.isBestCost && " ★"}
                </td>
                <td>{offer.validity || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mk-note">{comparison.method}</p>
      <p className="mk-note">{comparison.disclaimer}</p>
    </>
  );
}

type BodyProps = { detail: NonNullable<RequestDetail>; t: Translate; onOffer: (() => void) | null };

function RequestBody({ detail, t, onOffer }: BodyProps) {
  const { lang } = useI18n();
  const { request, matches, comparison } = detail;
  const rows = [
    [t("ml_f_purpose"), request.purpose],
    [t("ml_f_tenor"), request.tenor ? `${formatNumber(request.tenor, lang, 0)} ${t("ml_months")}` : ""],
    [t("ml_f_sector"), request.sector],
    [t("ml_f_collateral"), request.collateral],
    [t("ml_created"), formatDay(request.created, lang)],
  ] as const;
  return (
    <>
      <div className="mk-chips">
        <Chip kind="accent">{statusLabel(t)(request.status)}</Chip>
        {request.isSharia && <Chip kind="good">{t("ml_sharia_badge")}</Chip>}
      </div>
      <div className="mk-score-big">
        <b>{formatMoney(request.amount, "", lang)}</b>
        <span>{request.currency}</span>
      </div>
      <KeyValues rows={rows} />
      <h3 className="mk-h">{t("ml_routed")}</h3>
      <div className="mk-stack">
        {matches.slice(0, MAX_MATCHES).map((match, index) => (
          <MatchCard key={index} match={match} title={<MatchTitle name={match.productName} by={match.providerName} />} />
        ))}
        {!matches.length && <Empty>{t("ml_no_match")}</Empty>}
      </div>
      {comparison.offers.length > 0 ? (
        <OfferTable comparison={comparison} t={t} />
      ) : (
        <p className="mk-note">{t("ml_no_offers")}</p>
      )}
      {onOffer && (
        <div className="mk-actions">
          <button className="btn btn-primary" type="button" id="mlOfferBtn" onClick={onOffer}>
            {t("ml_make_offer")}
          </button>
        </div>
      )}
    </>
  );
}

type RequestDrawerProps = {
  id: string;
  t: Translate;
  /** Only a signed-in company may answer a request with an offer. */
  canOffer: boolean;
  onClose: () => void;
  onOfferSent: () => void;
};

/* One funding request: the products it was routed to, then the offers side by side. */
export function RequestDrawer({ id, t, canOffer, onClose, onOfferSent }: RequestDrawerProps) {
  const detail = useLoad(id, () => loadDetail(id));
  const [isOffering, setIsOffering] = useState(false);
  const loaded = detail.isLoading ? null : detail.data;

  if (loaded && isOffering) {
    return <OfferDrawer target={loaded.request} t={t} onClose={onClose} onSent={onOfferSent} />;
  }
  return (
    <Drawer title={loaded ? t("ml_request") : ""} onClose={onClose}>
      {detail.isLoading && <Loading />}
      {!detail.isLoading && !loaded && <Empty>{t("ml_req_empty")}</Empty>}
      {loaded && <RequestBody detail={loaded} t={t} onOffer={canOffer ? () => setIsOffering(true) : null} />}
    </Drawer>
  );
}
