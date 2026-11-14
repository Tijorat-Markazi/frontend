import { useI18n } from "../../shell/i18n";
import { Chip, Drawer, formatDay, KeyValues, safeHttpUrl } from "../../shell/market";
import type { Translate } from "../../shell/market";
import { amountRange, categoryLabel, segmentLabel, tenorRange } from "./parts";
import type { FinanceProduct } from "./types";

type ProductDrawerProps = {
  product: FinanceProduct;
  t: Translate;
  onClose: () => void;
  /** Starts a funding request for this kind of product. */
  onRequest: () => void;
};

/* One finance product in full, with the provider's own page when it gave a web address. */
export function ProductDrawer({ product, t, onClose, onRequest }: ProductDrawerProps) {
  const { lang } = useI18n();
  const officialPage = safeHttpUrl(product.link);
  const rows = [
    [t("ml_provider"), product.providerName],
    [t("ml_instrument"), product.instrument],
    [t("ml_f_amount"), amountRange(product, lang)],
    [t("ml_f_tenor"), tenorRange(product, lang, t)],
    [t("ml_rate"), product.rate],
    [t("ml_fee"), product.feeModel],
    [t("ml_f_collateral"), product.collateral],
    [t("ml_eligibility"), product.eligibility],
    [t("ml_docs"), product.docs.join(", ")],
    [t("ml_segments"), product.segments.map(segmentLabel(t)).join(", ")],
    [t("ml_licence"), product.licence],
    [t("ml_updated"), formatDay(product.updated, lang)],
  ] as const;
  return (
    <Drawer title={product.name} onClose={onClose}>
      <div className="mk-chips">
        <Chip kind="accent">{categoryLabel(t)(product.category)}</Chip>
        {product.isSharia && <Chip kind="good">{t("ml_sharia_badge")}</Chip>}
      </div>
      <KeyValues rows={rows} />
      {product.rejectReasons.length > 0 && (
        <div className="mk-assume">
          <b>{t("ml_reject_reasons")}</b>
          <ul>
            {product.rejectReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mk-actions">
        <button className="btn btn-primary" type="button" id="mlToReq" onClick={onRequest}>
          {t("ml_to_request")}
        </button>
        {officialPage && (
          <a className="btn btn-ghost" href={officialPage} target="_blank" rel="noopener noreferrer">
            {t("ml_official")}
          </a>
        )}
      </div>
      <p className="mk-note">{t("ml_disclaimer_card")}</p>
    </Drawer>
  );
}
