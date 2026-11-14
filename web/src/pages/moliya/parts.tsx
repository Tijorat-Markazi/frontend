/*
 * Pieces several finance panels share: code labels, the amount and tenor
 * lines, the product card and the output slot of an AI block.
 */
import type { CSSProperties } from "react";
import type { Lang } from "@legacy/data.js";
import { useI18n } from "../../shell/i18n";
import { activateOnKey, AiDraft, Chip, formatMoney, formatNumber, Loading } from "../../shell/market";
import type { CopilotResult, DraftRow, Translate } from "../../shell/market";
import type { FinanceProduct } from "./types";

/* Codes the dictionary does not know are shown as they came. */
export const categoryLabel = (t: Translate) => (code: string): string => t(`ml_cat_${code}`, code);
export const segmentLabel = (t: Translate) => (code: string): string => t(`ml_seg_${code}`, code);
export const investorTypeLabel = (t: Translate) => (code: string): string => t(`ml_inv_${code}`, code);
export const ideaModelLabel = (t: Translate) => (code: string): string => t(`ml_idea_${code}`, code);
export const statusLabel = (t: Translate) => (code: string): string => t(`status_${code}`, code);

export const AI_INPUT: CSSProperties = {
  padding: "10px 13px",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card)",
  color: "var(--ink)",
  font: "inherit",
};
export const AI_HINT: CSSProperties = { fontSize: 13.5, color: "var(--text)" };
export const NESTED_LIST: CSSProperties = { marginLeft: 16 };
export const PRICE: CSSProperties = { fontSize: 16 };
export const BOX_HEADING: CSSProperties = { marginTop: 14 };

/** "500 mln – 2 mlrd UZS", or "" when the product names neither bound. */
export function amountRange(product: FinanceProduct, lang: Lang): string {
  if (!product.minAmount && !product.maxAmount) return "";
  return `${formatMoney(product.minAmount, "", lang)} – ${formatMoney(product.maxAmount, product.currency, lang)}`;
}

/** "6–36 oy", or "" when the product names neither bound. */
export function tenorRange(product: FinanceProduct, lang: Lang, t: Translate): string {
  if (!product.tenorMin && !product.tenorMax) return "";
  return `${formatNumber(product.tenorMin, lang, 0)}–${formatNumber(product.tenorMax, lang, 0)} ${t("ml_months")}`;
}

type ProductCardProps = { product: FinanceProduct; t: Translate; onOpen?: () => void };

/* The provider desk lists the same card without a detail to open. */
export function ProductCard({ product, t, onOpen }: ProductCardProps) {
  const { lang } = useI18n();
  const opening = onOpen ? { tabIndex: 0, role: "button", onClick: onOpen, onKeyDown: activateOnKey(onOpen) } : {};
  return (
    <article className="mk-card" data-fp={product.id} {...opening}>
      <div className="mk-chips">
        <Chip kind="accent">{categoryLabel(t)(product.category)}</Chip>
        {product.isSharia && <Chip kind="good">{t("ml_sharia_badge")}</Chip>}
        {product.isStale && <Chip kind="warn">{t("ml_stale")}</Chip>}
      </div>
      <h3>{product.name}</h3>
      {product.summary && <p className="mk-desc">{product.summary}</p>}
      <div className="mk-meta">
        <span>{product.providerName}</span>
        {product.instrument && (
          <span>
            <b>{product.instrument}</b>
          </span>
        )}
        {product.sla > 0 && (
          <span>
            SLA{" "}
            <b>
              {formatNumber(product.sla, lang, 0)} {t("ml_days")}
            </b>
          </span>
        )}
      </div>
      <div className="mk-card-foot">
        <span className="mk-price" style={PRICE}>
          {amountRange(product, lang) || "—"}
        </span>
        <span className="mk-chip is-ghost">{tenorRange(product, lang, t) || "—"}</span>
      </div>
    </article>
  );
}

export type AiState =
  | { status: "idle" }
  | { status: "needInput" }
  | { status: "loading" }
  | { status: "done"; result: CopilotResult };

type AiOutputProps = {
  id: string;
  state: AiState;
  needKey: string;
  t: Translate;
  rows: (result: CopilotResult) => DraftRow[];
};

export function AiOutput({ id, state, needKey, t, rows }: AiOutputProps) {
  return (
    <div id={id} className={state.status === "needInput" ? "mk-msg is-err" : undefined}>
      {state.status === "needInput" && t(needKey)}
      {state.status === "loading" && <Loading />}
      {state.status === "done" && <AiDraft result={state.result} rows={rows(state.result)} />}
    </div>
  );
}
