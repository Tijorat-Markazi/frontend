import { useState } from "react";
import { useI18n } from "../../shell/i18n";
import { Empty, formatNumber, listOf, Loading, marketJson, Segment, useLoad } from "../../shell/market";
import type { Translate } from "../../shell/market";
import { CapitalCard } from "./CapitalCards";
import { CapitalDrawer } from "./CapitalDrawer";
import { CapitalForm } from "./CapitalForms";
import { CAPITAL_PARSERS, CAPITAL_PATHS } from "./capitalTypes";
import type { CapitalRow, CapitalSegment } from "./capitalTypes";
import { IdeaDrawer } from "./IdeaDrawer";

const SEGMENTS: readonly CapitalSegment[] = ["projects", "startups", "investors", "ideas"];

const isSegment = (value: string): value is CapitalSegment => SEGMENTS.some(segment => segment === value);

type Listing = { segment: CapitalSegment; rows: CapitalRow[] };

async function loadListing(segment: CapitalSegment): Promise<Listing> {
  const answer = await marketJson(CAPITAL_PATHS[segment]);
  return { segment, rows: listOf(answer.items, CAPITAL_PARSERS[segment]) };
}

function OpenRow({ row, t, onClose }: { row: CapitalRow; t: Translate; onClose: () => void }) {
  if (row.kind === "ideas") return <IdeaDrawer id={row.id} t={t} onClose={onClose} />;
  if (row.kind === "investors") return null;
  return <CapitalDrawer row={row} t={t} onClose={onClose} />;
}

/* The capital market: projects, startups, investors and the idea exchange, each with its publish form. */
export function CapitalPanel({ t }: { t: Translate }) {
  const { lang } = useI18n();
  const [segment, setSegment] = useState<CapitalSegment>("projects");
  const [openId, setOpenId] = useState<string | null>(null);
  const listing = useLoad(segment, () => loadListing(segment));
  /* The previous list stays in `data` while the next loads; it is not this segment's. */
  const rows = !listing.isLoading && listing.data?.segment === segment ? listing.data.rows : null;
  const openRow = rows?.find(row => row.id === openId);

  const choose = (value: string): void => {
    if (!isSegment(value)) return;
    setOpenId(null);
    setSegment(value);
  };

  return (
    <>
      <div className="mk-row" style={{ marginBottom: 14 }}>
        <Segment
          id="mlCapSeg"
          options={SEGMENTS.map(value => ({ value, label: t(`ml_cap_${value}`) }))}
          value={segment}
          onChange={choose}
        />
        <span className="mk-count" id="mlCapCount">
          {rows && t("ml_cap_count").replace("{n}", formatNumber(rows.length, lang, 0))}
        </span>
      </div>
      <div className="mk-grid" id="mlCapGrid">
        {!rows && <Loading />}
        {rows && !rows.length && <Empty>{t("ml_cap_empty")}</Empty>}
        {rows?.map(row => (
          <CapitalCard key={row.id} row={row} t={t} onOpen={() => setOpenId(row.id)} />
        ))}
      </div>
      <div className="mk-box w12" style={{ marginTop: "var(--mk-gap)" }} id="mlCapForm">
        <CapitalForm key={segment} segment={segment} t={t} onSaved={listing.reload} />
      </div>
      {openRow && <OpenRow row={openRow} t={t} onClose={() => setOpenId(null)} />}
    </>
  );
}
