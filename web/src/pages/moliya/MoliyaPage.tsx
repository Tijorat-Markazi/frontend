import { useCallback, useEffect, useState } from "react";
import { T_MOLIYA } from "@legacy/markets-i18n.js";
import { useI18n } from "../../shell/i18n";
import {
  formatNumber,
  MarketHero,
  marketJson,
  MarketTabs,
  PulseStats,
  record,
  TabPanel,
  texts,
  useMarketText,
  usePulse,
  useTabs,
} from "../../shell/market";
import type { Translate } from "../../shell/market";
import { PublicPage } from "../../shell/PublicPage";
import { SiteFooter } from "../../shell/SiteFooter";
import { AuctionPanel } from "./AuctionPanel";
import { CabinetPanel } from "./CabinetPanel";
import { CapitalPanel } from "./CapitalPanel";
import { IntelPanel } from "./IntelPanel";
import { MarketPanel } from "./MarketPanel";
import type { RequestPrefill } from "./RequestForm";
import { useVisitor } from "./visitor";

type MoliyaTab = "market" | "auction" | "capital" | "cabinet" | "intel";

/* Links from other pages open the request form directly. */
const REQUEST_HASH = "#request";

function MoliyaPulse({ t }: { t: Translate }) {
  const { lang } = useI18n();
  const pulse = usePulse();
  const moliya = record(pulse?.moliya);
  const items = pulse
    ? [
        { value: formatNumber(moliya.products, lang, 0), label: t("ml_k_products") },
        { value: formatNumber(moliya.providers, lang, 0), label: t("ml_k_providers") },
        { value: formatNumber(moliya.requests, lang, 0), label: t("ml_k_requests") },
        { value: formatNumber(moliya.investors, lang, 0), label: t("ml_k_investors") },
      ]
    : [];
  return <PulseStats id="mlPulse" items={items} />;
}

/* The finance categories the server knows, asked once for the request form. */
function useCategories(): readonly string[] {
  const [categories, setCategories] = useState<readonly string[]>([]);
  useEffect(() => {
    let isCurrent = true;
    void marketJson("/api/moliya/meta").then(meta => {
      if (isCurrent) setCategories(texts(meta.categories));
    });
    return () => {
      isCurrent = false;
    };
  }, []);
  return categories;
}

export function MoliyaPage() {
  const t = useMarketText(T_MOLIYA);
  const tabs = useTabs<MoliyaTab>(window.location.hash === REQUEST_HASH ? "auction" : "market");
  const visitor = useVisitor();
  const categories = useCategories();
  const [prefill, setPrefill] = useState<RequestPrefill | null>(null);
  const [requestsStamp, setRequestsStamp] = useState(0);
  const reloadRequests = useCallback(() => setRequestsStamp(stamp => stamp + 1), []);
  const openTab = tabs.open;

  return (
    <PublicPage
      active="moliya.html"
      action={{ href: "index.html", labelKey: "d_home" }}
      footer={<SiteFooter hasRegisterLink />}
    >
      <main>
        <MarketHero
          index="02"
          eyebrow={t("ml_eyebrow")}
          headingHtml={t("ml_h1")}
          lead={t("ml_lead")}
          cta={{ href: "#mlTabs", label: t("ml_cta") }}
        >
          <MoliyaPulse t={t} />
        </MarketHero>
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <MarketTabs
              id="mlTabs"
              active={tabs.active}
              onChange={openTab}
              tabs={[
                { value: "market", label: t("ml_tab_market") },
                { value: "auction", label: t("ml_tab_auction") },
                { value: "capital", label: t("ml_tab_capital") },
                { value: "cabinet", label: t("ml_tab_cabinet") },
                { value: "intel", label: t("ml_tab_intel") },
              ]}
            />
            <TabPanel name="market" tabs={tabs}>
              <MarketPanel
                t={t}
                onRequest={product => {
                  setPrefill({ category: product.category, currency: product.currency });
                  openTab("auction");
                }}
              />
            </TabPanel>
            <TabPanel name="auction" tabs={tabs}>
              <AuctionPanel
                t={t}
                categories={categories}
                prefill={prefill}
                canOffer={visitor.company !== null}
                stamp={requestsStamp}
                onChanged={reloadRequests}
              />
            </TabPanel>
            <TabPanel name="capital" tabs={tabs}>
              <CapitalPanel t={t} />
            </TabPanel>
            <TabPanel name="cabinet" tabs={tabs}>
              <CabinetPanel t={t} visitor={visitor} onRequestsChanged={reloadRequests} />
            </TabPanel>
            <TabPanel name="intel" tabs={tabs}>
              <IntelPanel t={t} />
            </TabPanel>
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
