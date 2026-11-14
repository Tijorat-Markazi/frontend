import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BizIdPanel, cabinetGet, CabinetShell } from "../../shell/cabinet";
import type { CabinetNavItem } from "../../shell/cabinet";
import { useI18n } from "../../shell/i18n";
import { LegalPanel } from "../../shell/legal/LegalPanel";
import { AppealsView } from "./AppealsView";
import { CompaniesView } from "./CompaniesView";
import { ConferenceView } from "./ConferenceView";
import { DashboardView } from "./DashboardView";
import { NewsView } from "./NewsView";
import { QuestionsView } from "./QuestionsView";
import { fetchRegistrations, RegistrationsView } from "./RegistrationsView";
import { ReportView } from "./ReportView";
import { NAV_ICONS } from "./text";
import type { AssocTextKey } from "./text";
import { assocName, useAssocText } from "./types";
import type { Account } from "./types";

type ViewId = Exclude<keyof typeof NAV_ICONS, "groups">;

/* Sidebar order, as the panel has always had it. The group chat is its own
   full-screen page, not a panel view. */
const NAV: readonly { id: keyof typeof NAV_ICONS; label: AssocTextKey; href?: string }[] = [
  { id: "bizid", label: "nav_bizid" },
  { id: "dashboard", label: "nav_dash" },
  { id: "registrations", label: "nav_regs" },
  { id: "companies", label: "nav_comp" },
  { id: "questions", label: "nav_quest" },
  { id: "news", label: "nav_news" },
  { id: "report", label: "nav_report" },
  { id: "groups", label: "nav_groups", href: "chat.html" },
  { id: "appeals", label: "nav_appeals" },
  { id: "conference", label: "nav_conf" },
  { id: "legal", label: "nav_legal" },
];

const isViewId = (id: string): id is ViewId => id in NAV_ICONS && id !== "groups";

type CabinetProps = { account: Account; onLogout: () => void };

export function AssociationCabinet({ account, onLogout }: CabinetProps) {
  const { lang } = useI18n();
  const at = useAssocText();
  const [view, setView] = useState<ViewId>("dashboard");
  const [companies, setCompanies] = useState(account.companies);
  const [pending, setPending] = useState(0);
  const [hasMeeting, setHasMeeting] = useState(false);
  const name = assocName(account.assoc, lang);
  const assocId = account.assoc.id;

  /* The browser tab says which association, not just the account type. */
  useEffect(() => {
    if (name) document.title = `${name} — TIJORAT MARKAZI`;
  }, [name]);

  /* An active meeting for the dashboard, and the applications waiting, so the
     sidebar badge is right the moment the cabinet opens. */
  useEffect(() => {
    let isCurrent = true;
    void cabinetGet(`/api/conference?assoc=${encodeURIComponent(assocId)}`).then(answer => {
      if (isCurrent && answer.isOk) setHasMeeting(Boolean(answer.body.title));
    });
    void fetchRegistrations("pending").then(result => {
      if (isCurrent && result) setPending(result.pending);
    });
    return () => {
      isCurrent = false;
    };
  }, [assocId]);

  const nav: CabinetNavItem[] = NAV.map(item => ({
    id: item.id,
    label: at(item.label),
    icon: NAV_ICONS[item.id],
    href: item.href,
    badge: item.id === "registrations" ? pending : undefined,
  }));
  const shared = { at };

  const views: Record<ViewId, () => ReactNode> = {
    bizid: () => (
      <div id="bizidHost">
        <BizIdPanel />
      </div>
    ),
    dashboard: () => <DashboardView companies={companies} hasMeeting={hasMeeting} at={at} />,
    registrations: () => <RegistrationsView {...shared} onPending={setPending} />,
    companies: () => <CompaniesView {...shared} companies={companies} onCompanies={setCompanies} />,
    questions: () => <QuestionsView {...shared} />,
    news: () => <NewsView {...shared} />,
    report: () => <ReportView {...shared} />,
    conference: () => <ConferenceView {...shared} onActive={setHasMeeting} />,
    appeals: () => <AppealsView {...shared} />,
    /* After a withdrawal the panel itself ends the session and goes home. */
    legal: () => <LegalPanel panelClass="admin-panel" showCorrection />,
  };

  return (
    <CabinetShell
      id="asShell"
      navId="asNav"
      brandSub={name || at("brand_fallback")}
      brandSubId="asBrandSub"
      nav={nav}
      activeId={view}
      onSelect={id => isViewId(id) && setView(id)}
      title={at(NAV.find(item => item.id === view)?.label ?? "nav_dash")}
      backLabel={at("back")}
      logoutLabel={at("logout")}
      onLogout={onLogout}
      actions={
        <a className="btn btn-primary" id="aiNav" href="assistant.html" style={{ marginLeft: "auto" }}>
          🤖 {at("nav_ai")}
        </a>
      }
    >
      <section className="admin-view active" id={`view-${view}`} key={view}>
        {views[view]()}
      </section>
    </CabinetShell>
  );
}
