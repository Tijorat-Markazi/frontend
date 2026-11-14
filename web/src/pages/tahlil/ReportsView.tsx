import { DocButton } from "../../shell/cabinet";
import type { Translate } from "../../shell/market";
import type { Query } from "./data";

const EXPORT_PATH = "/api/analyst/export";

/** The selected period as a file. */
export function ReportsView({ query, t }: { query: Query; t: Translate }) {
  /* The export reads its parameters from a JSON POST, so the download cannot
     be a link: the button fetches it through the session and saves the answer. */
  const file = (kind: "xlsx" | "doc") => ({
    path: EXPORT_PATH,
    fallbackName: `tahlil.${kind}`,
    body: { kind, days: query.days },
  });

  return (
    <div className="an-box an-wide">
      <h3>{t("an_rep_h")}</h3>
      <p className="an-note">{t("an_rep_p")}</p>
      <ul className="an-list">
        <li>{t("an_rep_i1")}</li>
        <li>{t("an_rep_i2")}</li>
        <li>{t("an_rep_i3")}</li>
      </ul>
      <div className="an-actions">
        <DocButton {...file("xlsx")} className="btn btn-primary">
          {t("an_dl_xlsx")}
        </DocButton>
        <DocButton {...file("doc")}>{t("an_dl_doc")}</DocButton>
      </div>
      <p className="an-note">{t("an_rep_privacy")}</p>
    </div>
  );
}
