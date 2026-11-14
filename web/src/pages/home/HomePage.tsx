import { PublicPage } from "../../shell/PublicPage";
import { useApiJson } from "../../shell/useApiJson";
import { companiesOf } from "./homeData";
import type { Association, Directory, Showroom } from "./homeData";
import { HomeFooter } from "./HomeFooter";
import { HomeHero } from "./HomeHero";
import { HomePreviews, JoinCard, MottoBand } from "./HomePreviews";
import { StructureBand } from "./StructureBand";

/* The home page follows assembly.uz section for section: the hero with the
   member wall, the tinted structure band, two previews, the join card, the
   motto band and the full footer. Everything that depends on what is on the platform is
   read from the same public endpoints the full pages use, so the page shows
   the real platform rather than a marketing list that drifts out of date. */
export function HomePage() {
  const catalog = useApiJson<unknown>("/api/assoc/list");
  const directory = useApiJson<Directory>("/api/business-id/directory");
  const showroom = useApiJson<Showroom>("/api/showroom");

  const associations: Association[] =
    catalog.status === "ready" && Array.isArray(catalog.data) ? (catalog.data as Association[]) : [];
  const companies = companiesOf(directory.status === "ready" ? directory.data : null);
  const products = showroom.status === "ready" ? (showroom.data.items ?? []) : [];
  const companyCount = showroom.status === "ready" ? (showroom.data.companies?.length ?? 0) : null;
  const associationCount = catalog.status === "ready" ? associations.length : null;
  const isLoaded = catalog.status !== "loading" && directory.status !== "loading";

  return (
    <PublicPage
      active="index.html"
      action={{ href: "assistant.html", labelKey: "btn_signin" }}
      footer={<HomeFooter />}
    >
      <main>
        <HomeHero associations={associations} companies={companies} isLoaded={isLoaded} />
        <StructureBand companyCount={companyCount} associationCount={associationCount} />
        <HomePreviews associations={associations} products={products} />
        <JoinCard />
        <MottoBand />
      </main>
    </PublicPage>
  );
}
