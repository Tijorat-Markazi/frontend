import { LANGS } from "@legacy/data.js";
import type { Lang } from "@legacy/data.js";
import { formatDate, formatDateTime } from "../../shell/cabinet";
import { useI18n } from "../../shell/i18n";
import { listOf, record, text } from "../../shell/market/narrow";
import { OT } from "./text";
import type { CompanyTextKey } from "./text";

export type CompanyText = (key: CompanyTextKey) => string;

/** The company cabinet's own dictionary, in the reader's language. */
export function useCompanyText(): CompanyText {
  const { pick } = useI18n();
  return key => pick(OT[key]);
}

/** What every cabinet view is handed. Who is asking is the cookie session's business. */
export type ViewProps = { ot: CompanyText };

export type Trade = "export" | "import";

/** One showroom entry, exactly the five fields the server keeps. `img` is the
    address as typed or uploaded; validate it before it becomes a src. */
export type ShowItem = { name: string; price: string; desc: string; img: string; trade: Trade };

export const BIZ_COLUMNS = ["product", "sales", "price", "composition", "note"] as const;
export type BizColumn = (typeof BIZ_COLUMNS)[number];
export type BizRow = Record<BizColumn, string>;

export const EMPTY_BIZ_ROW: BizRow = { product: "", sales: "", price: "", composition: "", note: "" };

export type Company = {
  id: string;
  name: string;
  sector: string;
  assocId: string;
  assocName: string;
  assocI18n: Partial<Record<Lang, string>>;
  showroom: ShowItem[];
  bizrows: BizRow[];
};

/* Anything saved before the export/import split counts as export. */
function parseShowItem(value: unknown): ShowItem {
  const item = record(value);
  return {
    name: text(item.name),
    price: text(item.price),
    desc: text(item.desc),
    img: text(item.img),
    trade: item.trade === "import" ? "import" : "export",
  };
}

export const parseShowroom = (value: unknown): ShowItem[] => listOf(value, parseShowItem);

export const parseBizRows = (value: unknown): BizRow[] =>
  listOf(value, entry => {
    const row = record(entry);
    return {
      product: text(row.product),
      sales: text(row.sales),
      price: text(row.price),
      composition: text(row.composition),
      note: text(row.note),
    };
  });

export function parseCompany(value: unknown): Company {
  const item = record(value);
  const names = record(item.assocI18n);
  return {
    id: text(item.id),
    name: text(item.name),
    sector: text(item.sector),
    assocId: text(item.assocId),
    assocName: text(item.assocName),
    assocI18n: Object.fromEntries(LANGS.map(lang => [lang, text(names[lang])])),
    showroom: parseShowroom(item.showroom),
    bizrows: parseBizRows(item.bizrows),
  };
}

/** A date and time as the cabinet writes them. Production prints nothing for
    an API value that is not a date, rather than echoing it back. */
export const dateTimeOrBlank = (value: unknown, lang: string): string =>
  formatDate(value, lang) ? formatDateTime(value, lang) : "";
