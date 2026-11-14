import { useState } from "react";
import { dialogs } from "../../shell/dialogs";
import { useI18n } from "../../shell/i18n";
import {
  Chip,
  companyIdentity,
  Drawer,
  Empty,
  formatMoney,
  formatNumber,
  identity,
  KeyValues,
  marketJson,
  Msg,
  useLoad,
} from "../../shell/market";
import type { Notice, Translate } from "../../shell/market";
import { parseOpenedIdea } from "./capitalTypes";
import type { OpenedIdea } from "./capitalTypes";
import { AI_HINT, ideaModelLabel } from "./parts";

const postIdea = (op: "open" | "nda", id: string) =>
  marketJson("/api/moliya/idea", companyIdentity.withPerson({ op, id }));

function Confidential({ opened, t }: { opened: OpenedIdea; t: Translate }) {
  return (
    <div className="mk-draft">
      <h3 className="mk-h">{t("ml_confidential")}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{opened.confidential}</p>
      {opened.terms && (
        <div className="mk-assume">
          <b>{t("ml_terms")}</b>
          <p>{opened.terms}</p>
        </div>
      )}
    </div>
  );
}

type IdeaBodyProps = { opened: OpenedIdea; t: Translate; onAccept: () => void; notice: Notice | null };

function IdeaBody({ opened, t, onAccept, notice }: IdeaBodyProps) {
  const { lang } = useI18n();
  const { idea } = opened;
  const rows = [
    [t("ml_author"), idea.author],
    [t("ml_price"), idea.price ? formatMoney(idea.price, idea.currency, lang) : ""],
    ["IP", idea.ipStatus],
    ["NDA", formatNumber(idea.ndaCount, lang, 0)],
  ] as const;
  return (
    <>
      <div className="mk-chips">
        <Chip kind="accent">{ideaModelLabel(t)(idea.model)}</Chip>
        {idea.sector && <Chip kind="ghost">{idea.sector}</Chip>}
      </div>
      <p className="mk-desc" style={{ WebkitLineClamp: 99 }}>
        {idea.teaser}
      </p>
      <KeyValues rows={rows} />
      {opened.isNdaSigned ? (
        <Confidential opened={opened} t={t} />
      ) : (
        <div className="mk-ai">
          <h3>🔒 {t("ml_nda_gate")}</h3>
          <p style={AI_HINT}>{opened.notice}</p>
          <div className="mk-actions">
            <button className="btn btn-primary" type="button" id="mlNda" onClick={onAccept}>
              {t("ml_accept_nda")}
            </button>
          </div>
          <Msg notice={notice} t={t} />
        </div>
      )}
      <p className="mk-note">{t("ml_idea_note")}</p>
    </>
  );
}

/* Idea Exchange: the teaser first; the confidential body only after an NDA is on record. */
export function IdeaDrawer({ id, t, onClose }: { id: string; t: Translate; onClose: () => void }) {
  const opened = useLoad(`idea|${id}`, async () => parseOpenedIdea(await postIdea("open", id)));
  const [notice, setNotice] = useState<Notice | null>(null);

  const acceptNda = async (): Promise<void> => {
    if (!identity.email()) {
      setNotice({ key: "ml_need_email", kind: "err" });
      return;
    }
    if (!(await dialogs.confirm(t("ml_nda_confirm")))) return;
    await postIdea("nda", id);
    opened.reload();
  };

  /* Nothing opens until the server has said who may see what. */
  if (!opened.data) return null;
  if (opened.data.error === "identify_first") {
    return (
      <Drawer title="" onClose={onClose}>
        <Empty>{t("ml_need_email")}</Empty>
      </Drawer>
    );
  }
  if (!opened.data.ok) return null;
  return (
    <Drawer title={opened.data.idea.title} onClose={onClose}>
      <IdeaBody opened={opened.data} t={t} onAccept={() => void acceptNda()} notice={notice} />
    </Drawer>
  );
}
