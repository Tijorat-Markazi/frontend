import { useEffect, useState } from "react";
import { useI18n } from "../../shell/i18n";
import {
  Empty,
  FacetSelect,
  formatNumber,
  Loading,
  marketJson,
  marketQuery,
  Segment,
  useLoad,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { FinanceFinder } from "./FinanceFinder";
import type { FoundNeed } from "./FinanceFinder";
import { ProductCard } from "./parts";
import { ProductDrawer } from "./ProductDrawer";
import { parseProductListing, REQUEST_CURRENCIES } from "./types";
import type { FinanceProduct } from "./types";

const TYPING_DELAY_MS = 300;
const SEGMENT_CATEGORIES = ["banking", "nobank", "islamic", "equity", "insurance"] as const;

type Filters = { q: string; amount: string; tenor: string; currency: string; category: string; isSharia: boolean };

const NO_FILTERS: Filters = { q: "", amount: "", tenor: "", currency: "", category: "", isSharia: false };

const productsUrl = (filters: Filters): string =>
  `/api/moliya/products?${marketQuery({
    q: filters.q.trim(),
    category: filters.category,
    amount: filters.amount,
    tenor: filters.tenor,
    currency: filters.currency,
    sharia: filters.isSharia,
  })}`;

/**
 * `shown` is what the fields say; `applied` is what the list was asked for.
 * Typing settles for a moment first; a category or an AI answer applies at once.
 */
function useFilters() {
  const [shown, setShown] = useState(NO_FILTERS);
  const [applied, setApplied] = useState(NO_FILTERS);
  useEffect(() => {
    const timer = window.setTimeout(() => setApplied(shown), TYPING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  const type = (patch: Partial<Filters>): void => setShown(previous => ({ ...previous, ...patch }));
  const applyNow = (patch: Partial<Filters>): void => {
    const next = { ...shown, ...patch };
    setShown(next);
    setApplied(next);
  };
  return { shown, applied, type, applyNow };
}

function foundPatch(need: FoundNeed): Partial<Filters> {
  return {
    isSharia: need.isSharia,
    ...(need.amount && { amount: need.amount }),
    ...(need.tenor && { tenor: need.tenor }),
    ...(need.currency && { currency: need.currency }),
    ...(need.category && { category: need.category }),
  };
}

type MarketPanelProps = { t: Translate; onRequest: (product: FinanceProduct) => void };

/* The marketplace: the AI finder, the filters and the product grid. */
export function MarketPanel({ t, onRequest }: MarketPanelProps) {
  const { lang } = useI18n();
  const filters = useFilters();
  const [openId, setOpenId] = useState<string | null>(null);
  const url = productsUrl(filters.applied);
  const listing = useLoad(url, async () => parseProductListing(await marketJson(url)));
  const products = listing.data?.items ?? [];
  const openProduct = products.find(product => product.id === openId);
  const { shown } = filters;

  const categories = [
    { value: "", label: t("ml_cat_all") },
    ...SEGMENT_CATEGORIES.map(code => ({ value: code, label: t(`ml_cat_${code}`) })),
    { value: "development", label: t("ml_cat_dev") },
  ];

  return (
    <>
      <FinanceFinder t={t} onFound={need => filters.applyNow(foundPatch(need))} />
      <div className="mk-row" style={{ marginBottom: 14 }}>
        <Segment
          id="mlCategory"
          options={categories}
          value={shown.category}
          onChange={category => filters.applyNow({ category })}
        />
      </div>
      <div className="mk-filter">
        <input
          type="search"
          id="mlQ"
          placeholder={t("ml_search")}
          autoComplete="off"
          value={shown.q}
          onChange={event => filters.type({ q: event.target.value })}
        />
        <input
          type="number"
          id="mlAmount"
          placeholder={t("ml_amount")}
          min="0"
          value={shown.amount}
          onChange={event => filters.type({ amount: event.target.value })}
        />
        <input
          type="number"
          id="mlTenor"
          placeholder={t("ml_tenor")}
          min="0"
          value={shown.tenor}
          onChange={event => filters.type({ tenor: event.target.value })}
        />
        <FacetSelect
          id="mlCurrency"
          value={shown.currency}
          allLabel={t("ml_all_cur")}
          options={REQUEST_CURRENCIES}
          onChange={currency => filters.type({ currency })}
        />
        <label className="mk-chip is-ghost" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            id="mlSharia"
            style={{ accentColor: "var(--mk)" }}
            checked={shown.isSharia}
            onChange={event => filters.type({ isSharia: event.target.checked })}
          />{" "}
          <span>{t("ml_only_sharia")}</span>
        </label>
        <span className="mk-count" id="mlCount">
          {listing.data && t("ml_count").replace("{n}", formatNumber(listing.data.total, lang, 0))}
        </span>
      </div>
      <div className="mk-grid" id="mlGrid">
        {listing.isLoading && <Loading />}
        {!listing.isLoading && !products.length && <Empty>{t("ml_empty")}</Empty>}
        {!listing.isLoading &&
          products.map(product => (
            <ProductCard key={product.id} product={product} t={t} onOpen={() => setOpenId(product.id)} />
          ))}
      </div>
      <p className="mk-note" id="mlDisclaimer" style={{ marginTop: "var(--mk-gap)" }}>
        {listing.data?.disclaimer}
      </p>
      {openProduct && (
        <ProductDrawer
          product={openProduct}
          t={t}
          onClose={() => setOpenId(null)}
          onRequest={() => {
            setOpenId(null);
            onRequest(openProduct);
          }}
        />
      )}
    </>
  );
}
