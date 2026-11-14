/*
 * XARIDOR: the B2B buyer cabinet (port of xaridor.js).
 *
 * The one cabinet that belongs to the side doing the buying: the catalogue,
 * price requests and their offers, orders, message threads, the profile and
 * the rights panel. B2B is pinned server side and simply stated in the topbar.
 */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../shell/i18n";
import { LegalPanel } from "../../shell/legal/LegalPanel";
import { useCabinetLogin } from "../../shell/cabinet";
import { dialogs } from "../../shell/dialogs";
import { formatNumber, useMarketText } from "../../shell/market";
import type { Translate } from "../../shell/market";
import { goTo } from "../../shell/navigate";
import { PageBackground } from "../../shell/PageBackground";
import { auth } from "../../shell/session";
import { BuyerShell } from "./BuyerShell";
import type { BuyerNavItem } from "./BuyerShell";
import { CatalogView } from "./CatalogView";
import { LoginCard } from "./LoginCard";
import { OrdersView } from "./OrdersView";
import { ProfileView } from "./ProfileView";
import { RfqView } from "./RfqView";
import { ThreadsView } from "./ThreadsView";
import { loadHome, OWN_PAGE, XARIDOR_TEXT } from "./types";
import type { BuyerView, Cabinet, Home } from "./types";

const NAV: readonly { view: BuyerView; icon: string }[] = [
  { view: "catalog", icon: "🔎" },
  { view: "rfq", icon: "📩" },
  { view: "orders", icon: "📦" },
  { view: "threads", icon: "💬" },
  { view: "profile", icon: "🏢" },
  /* Rights under articles 21-22 of ZRU-547, where the account already is. */
  { view: "legal", icon: "⚙️" },
];
/* The order the sections sit in the page, which is not the menu's. */
const SECTIONS: readonly BuyerView[] = ["catalog", "rfq", "orders", "threads", "legal", "profile"];

/** Counts that answer "is there anything waiting for me here". */
function waitingCount(view: BuyerView, home: Home): number {
  if (view === "rfq") return home.rfqs.filter(rfq => rfq.quoteCount > 0).length;
  if (view === "orders") return home.deals.filter(deal => deal.stage !== "closed").length;
  if (view === "threads") return home.inquiries.filter(thread => thread.status === "answered").length;
  return 0;
}

type CabinetViewProps = {
  /** The state the cabinet opens with; the views keep it fresh from there. */
  initialHome: Home;
  t: Translate;
  onLogout: () => void;
};

/* Ends the server session, then leaves for the home page. When the server
   cannot be reached the cabinet stays open and a dialog says why. */
function signOutHome(): void {
  void auth.logout().then(
    () => goTo("index.html"),
    (error: unknown) => void dialogs.alert(error instanceof Error ? error.message : String(error)),
  );
}

function CabinetView({ initialHome, t, onLogout }: CabinetViewProps) {
  const { lang } = useI18n();
  const [view, setView] = useState<BuyerView>("catalog");
  const [home, setHome] = useState(initialHome);

  const refresh = useCallback(async (): Promise<void> => {
    const fresh = await loadHome();
    if (fresh) setHome(fresh);
  }, []);
  const cabinet: Cabinet = { home, refresh };

  const nav: BuyerNavItem<BuyerView>[] = NAV.map(item => {
    const waiting = waitingCount(item.view, home);
    return {
      value: item.view,
      label: t(`xr_v_${item.view}`),
      icon: <span aria-hidden="true">{item.icon}</span>,
      badge: waiting ? formatNumber(waiting, lang, 0) : undefined,
    };
  });
  const content: Record<Exclude<BuyerView, "catalog">, () => ReactNode> = {
    rfq: () => <RfqView cabinet={cabinet} t={t} onDealOpened={() => setView("orders")} />,
    orders: () => <OrdersView cabinet={cabinet} t={t} />,
    threads: () => <ThreadsView cabinet={cabinet} t={t} />,
    profile: () => (
      <ProfileView
        cabinet={cabinet}
        t={t}
        onBuyer={buyer => setHome(current => ({ ...current, buyer }))}
        onSaved={saved => setHome(current => ({ ...current, saved }))}
      />
    ),
    legal: () => (
      <LegalPanel panelClass="panel co-panel" showCorrection onWithdrawn={signOutHome} />
    ),
  };

  return (
    <BuyerShell
      id="xrShell"
      ids={{ nav: "xrNav", brandSub: "xrBrandSub", title: "xrViewTitle", logout: "xrLogout" }}
      brandSub={home.buyer.name || t("xr_brand")}
      nav={nav}
      active={view}
      onSelect={setView}
      title={t(`xr_v_${view}`)}
      backLabel={t("xr_back_site")}
      logoutLabel={t("xr_logout")}
      onLogout={onLogout}
      topbar={
        <span className="mk-badge" id="xrChannel" style={{ marginLeft: "auto" }} title={t("xr_b2b_note")}>
          {home.channel.toUpperCase()}
        </span>
      }
    >
      {SECTIONS.map(name => (
        <section className={name === view ? "admin-view active" : "admin-view"} id={`view-${name}`} key={name}>
          {name === "catalog" ? (
            <CatalogView cabinet={cabinet} t={t} onSaved={saved => setHome(current => ({ ...current, saved }))} />
          ) : (
            name === view && content[name]()
          )}
        </section>
      ))}
    </BuyerShell>
  );
}

export function XaridorPage() {
  const t = useMarketText(XARIDOR_TEXT);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  /* A buyer session whose cabinet will not load goes back to the form with
     the reason, not into an empty cabinet. */
  const openHome = useCallback(async (): Promise<Home | null> => {
    const home = await loadHome();
    if (!home) setErrorKey("xr_e_load");
    return home;
  }, []);
  /* The shared sign-in knows every tier. Someone who types a company or admin
     login here is sent to THEIR cabinet rather than refused. */
  const { state, submit } = useCabinetLogin<Home>({ role: "buyer", ownPage: OWN_PAGE, signIn: openHome });

  const handleSignIn = async (login: string, password: string): Promise<boolean> => {
    setErrorKey(null);
    const isAccepted = await submit(login, password);
    /* Keeps "could not load" when that is why the form stays. */
    if (!isAccepted) setErrorKey(current => current ?? "xr_login_err");
    return isAccepted;
  };

  /* Nothing is shown while the server is asked who is signed in. */
  if (state.status === "checking") return <PageBackground />;
  return (
    <>
      <PageBackground />
      {state.status === "signedIn" ? (
        <CabinetView initialHome={state.account} t={t} onLogout={signOutHome} />
      ) : (
        <LoginCard t={t} errorKey={errorKey} onSubmit={handleSignIn} />
      )}
    </>
  );
}
