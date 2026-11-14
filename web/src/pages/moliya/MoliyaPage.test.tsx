import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bodiesSentTo, refused, signInAs, stubCabinetApi } from "../../shell/cabinet/testApi";
import { formatMoney } from "../../shell/market";
import { HOSTILE, renderPage } from "../../test/renderPage";
import { MoliyaPage } from "./MoliyaPage";
import {
  COMPANY_USER,
  drawer,
  LOAN,
  openTab,
  PRODUCTS,
  renderMoliya,
  REQUEST,
  REQUEST_ROUTES,
  typeInto,
  urlsOf,
  uz,
} from "./testKit";
import type { Routes } from "./testKit";

const NEED = {
  ok: true,
  review: "AI qoralamasi — tekshiring",
  data: { amount: 2000000000, currency: "UZS", tenor: 12, category: "islamic", sharia: true, purpose: "Aylanma mablag'" },
};
const FOUND_URL = "/api/moliya/products?category=islamic&amount=2000000000&tenor=12&currency=UZS&sharia=true";

describe("MoliyaPage products", () => {
  it("lists products with their amount range, count and disclaimer", async () => {
    const { container } = await renderMoliya();

    expect(container.querySelectorAll("#mlGrid .mk-card")).toHaveLength(2);
    expect(container.querySelector("#mlCount")?.textContent).toBe(uz("ml_count").replace("{n}", "2"));
    expect(container.querySelector("#mlGrid .mk-price")?.textContent).toBe(
      `${formatMoney(1000, "", "uz")} – ${formatMoney(5000, "USD", "uz")}`,
    );
    expect(container.querySelector("#mlGrid .mk-chip.is-good")?.textContent).toBe(uz("ml_sharia_badge"));
    expect(container.querySelector("#mlDisclaimer")?.textContent).toBe("Shartlar o'zgarishi mumkin");
  });

  it("asks the server again when a category is chosen", async () => {
    const { container } = await renderMoliya({ "/api/moliya/products?category=banking": { items: [LOAN], total: 1 } });

    fireEvent.click(container.querySelector('#mlCategory [data-value="banking"]')!);

    await waitFor(() => expect(screen.queryByText("Murobaha")).toBeNull());
    expect(screen.getByText("Aylanma kredit")).toBeTruthy();
  });

  it("filters by an amount once typing stops", async () => {
    const { container } = await renderMoliya({ "/api/moliya/products?amount=3000": { items: [LOAN], total: 1 } });

    typeInto(container, "#mlAmount", "3000");

    await waitFor(() => expect(screen.queryByText("Murobaha")).toBeNull());
  });

  it("asks for sharia-aligned products only when the box is ticked", async () => {
    const { container, calls } = await renderMoliya();

    fireEvent.click(container.querySelector("#mlSharia")!);

    await waitFor(() => expect(urlsOf(calls)).toContain("/api/moliya/products?sharia=true"));
  });

  it("shows the empty note when the request fails", async () => {
    stubCabinetApi({ [PRODUCTS]: 500 });

    const { container } = renderPage(<MoliyaPage />);

    expect(await screen.findByText(uz("ml_empty"))).toBeTruthy();
    expect(container.querySelector("#mlCount")?.textContent).toBe(uz("ml_count").replace("{n}", "0"));
  });

  it("renders hostile product values as text", async () => {
    stubCabinetApi({
      [PRODUCTS]: { items: [{ id: "x", name: HOSTILE, providerName: HOSTILE, summary: HOSTILE }], total: 1, disclaimer: HOSTILE },
    });

    const { container } = renderPage(<MoliyaPage />);

    await screen.findAllByText(HOSTILE);
    expect(container.querySelector("#mlGrid img")).toBeNull();
    expect(container.querySelector("#mlDisclaimer img")).toBeNull();
  });

  it("shows the four live figures in the hero", async () => {
    const { container } = await renderMoliya({
      "/api/market/pulse": { ok: true, moliya: { products: 14, providers: 6, requests: 9, investors: 3 } },
    });

    await waitFor(() => expect(container.querySelectorAll("#mlPulse > div")).toHaveLength(4));
    expect(container.querySelector("#mlPulse")?.textContent).toContain(`14${uz("ml_k_products")}`);
  });
});

describe("MoliyaPage product detail", () => {
  it("opens a product with its terms, rejection reasons and official page", async () => {
    await renderMoliya();

    fireEvent.click(screen.getByText("Aylanma kredit"));

    expect(drawer()?.querySelector("#mkDrawerTitle")?.textContent).toBe("Aylanma kredit");
    expect(drawer()?.textContent).toContain("Garov yetarli emas");
    expect(drawer()?.querySelector("a")?.getAttribute("href")).toBe("https://alfa.example/loan");
  });

  it("offers no link when the provider's address is not a web address", async () => {
    stubCabinetApi({ [PRODUCTS]: { items: [{ ...LOAN, link: "javascript:alert(1)" }], total: 1 } });
    renderPage(<MoliyaPage />);

    fireEvent.click(await screen.findByText("Aylanma kredit"));

    expect(drawer()?.querySelector("#mlToReq")).not.toBeNull();
    expect(drawer()?.querySelector("a")).toBeNull();
  });

  it("starts a funding request for the product's category and currency", async () => {
    const { container } = await renderMoliya({ "/api/moliya/meta": { categories: ["banking", "islamic"] } });
    fireEvent.click(screen.getByText("Aylanma kredit"));

    fireEvent.click(drawer()!.querySelector("#mlToReq")!);

    await waitFor(() => expect(container.querySelector<HTMLSelectElement>("#frCategory")?.value).toBe("banking"));
    expect(container.querySelector<HTMLSelectElement>("#frCurrency")?.value).toBe("USD");
    expect(drawer()).toBeNull();
    expect(screen.getByRole("tab", { name: uz("ml_tab_auction") }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("MoliyaPage finance finder", () => {
  it("asks for a sentence before anything is sent", async () => {
    const { container, calls } = await renderMoliya();

    fireEvent.click(container.querySelector("#mlNlGo")!);

    expect(await screen.findByText(uz("ml_finder_need"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/copilot")).toHaveLength(0);
  });

  it("sends the sentence to the finance-need agent in the page language", async () => {
    const { container, calls } = await renderMoliya({ "/api/copilot": NEED });
    typeInto(container, "#mlNl", " Menga 2 mlrd kerak ");

    fireEvent.click(container.querySelector("#mlNlGo")!);

    await screen.findByText(/AI qoralamasi/);
    expect(bodiesSentTo(calls, "/api/copilot")).toEqual([
      { agent: "moliya.finance-need", lang: "uz", text: "Menga 2 mlrd kerak", email: "", name: "" },
    ]);
  });

  it("applies the answer to the filters and reloads the list once", async () => {
    const { container, calls } = await renderMoliya({ "/api/copilot": NEED, [FOUND_URL]: { items: [], total: 0 } });
    typeInto(container, "#mlNl", "Menga 2 mlrd kerak");

    fireEvent.click(container.querySelector("#mlNlGo")!);

    await waitFor(() => expect(urlsOf(calls)).toContain(FOUND_URL));
    expect(container.querySelector<HTMLInputElement>("#mlAmount")?.value).toBe("2000000000");
    expect(container.querySelector<HTMLInputElement>("#mlSharia")?.checked).toBe(true);
    expect(container.querySelector('#mlCategory [data-value="islamic"]')?.className).toBe("is-on");
    expect(urlsOf(calls).filter(url => url.startsWith(PRODUCTS))).toHaveLength(2);
  });

  it("explains a failed answer and leaves the filters alone", async () => {
    const { container, calls } = await renderMoliya({ "/api/copilot": { ok: false, error: "ai_off" } });
    typeInto(container, "#mlNl", "Menga kredit kerak");

    fireEvent.click(container.querySelector("#mlNlGo")!);

    expect(await screen.findByText(uz("mk_ai_off"))).toBeTruthy();
    expect(urlsOf(calls).filter(url => url.startsWith(PRODUCTS))).toHaveLength(1);
  });

  it("renders a hostile draft as text", async () => {
    const { container } = await renderMoliya({
      "/api/copilot": { ok: true, review: HOSTILE, data: { purpose: HOSTILE, whyThese: [HOSTILE] } },
    });
    typeInto(container, "#mlNl", "Menga kredit kerak");

    fireEvent.click(container.querySelector("#mlNlGo")!);

    await screen.findAllByText(new RegExp("onerror"));
    expect(container.querySelector("#mlNlOut img")).toBeNull();
  });
});

describe("MoliyaPage reverse auction", () => {
  async function renderAuction(routes: Routes = {}) {
    const view = await renderMoliya({ ...REQUEST_ROUTES, ...routes });
    openTab("ml_tab_auction");
    await screen.findByText("Uskuna xaridi");
    return view;
  }

  it("lists the open requests with their count", async () => {
    const { container } = await renderAuction();

    expect(container.querySelectorAll("#mlReqGrid .mk-card")).toHaveLength(1);
    expect(container.querySelector("#mlReqCount")?.textContent).toBe(uz("ml_req_count").replace("{n}", "1"));
    expect(screen.getByText(uz("status_open"))).toBeTruthy();
  });

  it("says so when there are no open requests", async () => {
    const { container } = await renderMoliya();

    openTab("ml_tab_auction");

    await waitFor(() => expect(container.querySelector("#mlReqGrid .mk-empty")?.textContent).toBe(uz("ml_req_empty")));
  });

  it("opens straight on the request form for a #request link", async () => {
    window.history.pushState({}, "", "/moliya.html#request");
    stubCabinetApi(REQUEST_ROUTES);

    const { container } = renderPage(<MoliyaPage />);

    expect(await screen.findByText("Uskuna xaridi")).toBeTruthy();
    expect(container.querySelector("#request #mlReqForm")).not.toBeNull();
    window.history.pushState({}, "", "/");
  });

  it("renders hostile request values as text", async () => {
    const { container } = await renderMoliya({
      "/api/moliya/requests": { items: [{ id: "x", status: "open", amount: 1, purpose: HOSTILE, ownerName: HOSTILE }] },
    });

    openTab("ml_tab_auction");

    await screen.findAllByText(HOSTILE);
    expect(container.querySelector("#mlReqGrid img")).toBeNull();
  });

  it("refuses a request without an amount", async () => {
    const { container, calls } = await renderAuction();

    fireEvent.submit(container.querySelector("#mlReqForm")!);

    expect(await screen.findByText(uz("ml_need_amount"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/moliya/request")).toHaveLength(0);
  });

  it("publishes the request, anonymous by default, and shows where it was routed", async () => {
    const { container, calls } = await renderAuction({
      "/api/moliya/request": {
        ok: true,
        matches: [{ score: 80, reasons: ["Summa mos"], product: { name: "Aylanma kredit", providerName: "Alfa Bank" } }],
      },
    });
    typeInto(container, "#frAmount", "5000");
    typeInto(container, "#frPurpose", "Aylanma");

    fireEvent.submit(container.querySelector("#mlReqForm")!);

    expect(await screen.findByText(uz("ml_req_ok").replace("{n}", "1"))).toBeTruthy();
    expect(container.querySelector("#mlReqMatches")?.textContent).toContain("Summa mos");
    expect(bodiesSentTo(calls, "/api/moliya/request")).toEqual([
      {
        amount: "5000",
        currency: "UZS",
        tenor: "",
        category: "",
        purpose: "Aylanma",
        sector: "",
        region: "",
        revenue: "",
        collateral: "",
        contact: "",
        sharia: false,
        anonymous: true,
        email: "",
        name: "",
      },
    ]);
    await waitFor(() => expect(urlsOf(calls).filter(url => url === "/api/moliya/requests")).toHaveLength(2));
  });

  it("says so when the request could not be published", async () => {
    const { container } = await renderAuction({ "/api/moliya/request": 500 });
    typeInto(container, "#frAmount", "5000");

    fireEvent.submit(container.querySelector("#mlReqForm")!);

    expect(await screen.findByText(uz("ml_req_fail"))).toBeTruthy();
  });

  it("shows a guest the request without offers or a way to make one", async () => {
    await renderAuction({ "/api/moliya/offers?requestId=r1": refused(403, { error: "forbidden" }) });

    fireEvent.click(screen.getByText("Uskuna xaridi"));

    await waitFor(() => expect(drawer()?.textContent).toContain(uz("ml_no_offers")));
    expect(drawer()?.textContent).toContain(uz("ml_no_match"));
    expect(drawer()?.querySelector("#mlOfferBtn")).toBeNull();
  });

  it("compares the offers for the request's owner and marks the cheapest", async () => {
    await renderAuction({
      "/api/moliya/offers?requestId=r1": {
        ok: true,
        offers: [
          { providerName: "Alfa Bank", ratePct: 22, feePct: 1, tenor: 12, allInPct: 23, bestCost: true },
          { providerName: HOSTILE, ratePct: 25, feePct: 0, tenor: 12, allInPct: 25 },
        ],
        method: "All-in % = stavka + komissiya",
        disclaimer: "Takliflar indikativ",
      },
    });

    fireEvent.click(screen.getByText("Uskuna xaridi"));

    await waitFor(() => expect(drawer()?.querySelectorAll("tbody tr")).toHaveLength(2));
    expect(drawer()?.querySelector("tr.is-best")?.textContent).toContain("★");
    expect(drawer()?.textContent).toContain("All-in % = stavka + komissiya");
    expect(drawer()?.querySelector("img")).toBeNull();
  });

  it("explains a request that no longer exists", async () => {
    await renderAuction({ "/api/moliya/request/matches?id=r1": { error: "not_found" } });

    fireEvent.click(screen.getByText("Uskuna xaridi"));

    await waitFor(() => expect(drawer()?.querySelector(".mk-empty")?.textContent).toBe(uz("ml_req_empty")));
  });

  it("lets a signed-in company answer with an offer on that request", async () => {
    signInAs("company", COMPANY_USER);
    const { calls } = await renderAuction({ "/api/moliya/offer": { ok: true } });
    fireEvent.click(screen.getByText("Uskuna xaridi"));
    await waitFor(() => expect(drawer()?.querySelector("#mlOfferBtn")).not.toBeNull());

    fireEvent.click(drawer()!.querySelector("#mlOfferBtn")!);
    typeInto(drawer()!, "#ofRate", "21.5");
    fireEvent.submit(drawer()!.querySelector("#mlOfferForm")!);

    expect(await screen.findByText(uz("ml_offer_ok"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/moliya/offer")).toEqual([
      {
        requestId: REQUEST.id,
        amount: "5000",
        currency: "USD",
        ratePct: "21.5",
        feePct: "",
        tenor: "12",
        grace: "",
        collateral: "",
        covenants: "",
        conditions: "",
        validity: "",
        slaDays: "",
      },
    ]);
    await waitFor(() => expect(drawer()).toBeNull());
    expect(urlsOf(calls).filter(url => url === "/api/moliya/requests")).toHaveLength(2);
  });

  it("says so when the offer is refused and keeps the form open", async () => {
    signInAs("company", COMPANY_USER);
    await renderAuction({ "/api/moliya/offer": refused(403, { error: "company_login_required" }) });
    fireEvent.click(screen.getByText("Uskuna xaridi"));
    await waitFor(() => expect(drawer()?.querySelector("#mlOfferBtn")).not.toBeNull());
    fireEvent.click(drawer()!.querySelector("#mlOfferBtn")!);

    fireEvent.submit(drawer()!.querySelector("#mlOfferForm")!);

    expect(await screen.findByText(uz("ml_offer_fail"))).toBeTruthy();
    expect(drawer()?.querySelector("#mlOfferForm")).not.toBeNull();
  });

  it("hides the offer button from a signed-in account that is not a company", async () => {
    signInAs("buyer", { id: "b1", name: "Xaridor" });
    await renderAuction();

    fireEvent.click(screen.getByText("Uskuna xaridi"));

    await waitFor(() => expect(drawer()?.textContent).toContain(uz("ml_no_offers")));
    expect(drawer()?.querySelector("#mlOfferBtn")).toBeNull();
  });
});
