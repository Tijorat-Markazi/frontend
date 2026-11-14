/*
 * Who may do what in the cabinet. No test here saves an e-mail: the kit keeps
 * a saved address for the life of the module, and these tests need a visitor
 * the page knows nothing about.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bodiesSentTo, refused, signInAs } from "../../shell/cabinet/testApi";
import type { ApiCall } from "../../shell/cabinet/testApi";
import { auth } from "../../shell/session";
import { setLoginResult } from "../../test/fakeSession";
import { HOSTILE } from "../../test/renderPage";
import { COMPANY_USER, drawer, LOAN, openTab, renderMoliya, typeInto, urlsOf, uz } from "./testKit";
import type { Routes } from "./testKit";

const PASSWORD = "s3cret-pair";
const COMPANY_SESSION = { role: "company", target: "company.html", user: COMPANY_USER };
const LEAD = { id: "r7", product: "Aylanma kredit", amount: 4000, currency: "USD", tenor: 18, score: 70, reasons: ["Summa mos"] };
const DESK = { ok: true, provider: COMPANY_USER, leads: [LEAD], products: [LOAN], offers: [] };
const COMPANY_ROUTES = {
  "/api/company/login": { ok: true, company: { ...COMPANY_USER, sector: "Moliya" } },
  "/api/moliya/provider": DESK,
};
const PERSONAL_PATHS = ["/api/moliya/passport", "/api/moliya/request/mine", "/api/moliya/provider"];

async function renderCabinet(routes: Routes = {}) {
  const view = await renderMoliya(routes);
  openTab("ml_tab_cabinet");
  await waitFor(() => expect(view.container.querySelector("#mlCabinet .mk-bento")).not.toBeNull());
  return view;
}

function signInThroughForm(container: HTMLElement): void {
  typeInto(container, "#mlLogin", " alfa ");
  typeInto(container, "#mlPass", PASSWORD);
  fireEvent.click(container.querySelector("#mlIn")!);
}

const personalCalls = (calls: readonly ApiCall[]): string[] =>
  urlsOf(calls).filter(url => PERSONAL_PATHS.includes(url));

describe("MoliyaPage cabinet for a guest", () => {
  it("offers the company sign-in and keeps the provider desk away", async () => {
    const { container } = await renderCabinet();

    expect(container.querySelector("#mlLogin")).not.toBeNull();
    expect(container.querySelector("#mlOut")).toBeNull();
    expect(container.querySelector("#mlProvider")).toBeNull();
  });

  it("asks the server for nothing personal before an e-mail or a company is known", async () => {
    const { calls } = await renderCabinet(COMPANY_ROUTES);

    expect(screen.getByText(uz("ml_no_passport"))).toBeTruthy();
    expect(screen.getByText(uz("ml_no_requests"))).toBeTruthy();
    expect(personalCalls(calls)).toEqual([]);
  });

  it("will not save a passport without an e-mail", async () => {
    const { container, calls } = await renderCabinet();

    fireEvent.submit(container.querySelector("#mlPassForm")!);

    expect(await screen.findByText(uz("ml_need_email"))).toBeTruthy();
    expect(personalCalls(calls)).toEqual([]);
  });
});

describe("MoliyaPage cabinet sign-in", () => {
  it("says so when the pair is refused and drops the password from the field", async () => {
    setLoginResult(null);
    const { container } = await renderCabinet(COMPANY_ROUTES);

    signInThroughForm(container);

    expect(await screen.findByText(uz("ml_login_fail"))).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#mlPass")?.value).toBe("");
    expect(container.querySelector("#mlProvider")).toBeNull();
  });

  it("opens the provider desk once the pair is accepted", async () => {
    setLoginResult(COMPANY_SESSION);
    const { container, calls } = await renderCabinet(COMPANY_ROUTES);

    signInThroughForm(container);

    await waitFor(() => expect(container.querySelector("#mlProvider")).not.toBeNull());
    expect(auth.login).toHaveBeenCalledWith("alfa", PASSWORD);
    expect(container.querySelector("#mlId b")?.textContent).toBe("Alfa Bank");
    expect(bodiesSentTo(calls, "/api/company/login")).toEqual([{}]);
  });

  it("signs in on Enter in the password field", async () => {
    setLoginResult(COMPANY_SESSION);
    const { container } = await renderCabinet(COMPANY_ROUTES);
    typeInto(container, "#mlLogin", "alfa");
    typeInto(container, "#mlPass", PASSWORD);

    fireEvent.keyDown(container.querySelector("#mlPass")!, { key: "Enter" });

    await waitFor(() => expect(container.querySelector("#mlOut")).not.toBeNull());
  });

  it("puts the pair in no request body or address", async () => {
    setLoginResult(COMPANY_SESSION);
    const { container, calls } = await renderCabinet(COMPANY_ROUTES);

    signInThroughForm(container);
    await waitFor(() => expect(container.querySelector("#mlProvider")).not.toBeNull());

    expect(calls.length).toBeGreaterThan(3);
    for (const call of calls) {
      expect(Object.keys(call.body)).not.toEqual(expect.arrayContaining(["login"]));
      expect(Object.keys(call.body)).not.toEqual(expect.arrayContaining(["password"]));
      expect(call.url + JSON.stringify(call.body)).not.toContain(PASSWORD);
      expect(call.url).not.toMatch(/[?&](login|password)=/);
    }
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(PASSWORD);
  });
});

describe("MoliyaPage cabinet for a signed-in company", () => {
  async function renderDesk(routes: Routes = {}) {
    signInAs("company", COMPANY_USER);
    const view = await renderCabinet({ ...COMPANY_ROUTES, ...routes });
    await waitFor(() => expect(view.container.querySelector("#mlProvider")).not.toBeNull());
    return view;
  }

  it("shows the company, its leads and its own products", async () => {
    const { container, calls } = await renderDesk();

    expect(container.querySelector("#mlId b")?.textContent).toBe("Alfa Bank");
    expect(container.querySelector("#mlLogin")).toBeNull();
    expect(container.querySelector("#mlProvider")?.textContent).toContain("Summa mos");
    expect(container.querySelectorAll("#mlProvider .mk-grid .mk-card")).toHaveLength(1);
    expect(bodiesSentTo(calls, "/api/moliya/provider")).toEqual([{}]);
  });

  it("says so when no request fits and no product is listed yet", async () => {
    await renderDesk({ "/api/moliya/provider": { ok: true, leads: [], products: [] } });

    expect(screen.getByText(uz("ml_no_leads"))).toBeTruthy();
    expect(screen.getByText(uz("ml_no_products"))).toBeTruthy();
  });

  it("renders hostile lead and product names as text", async () => {
    const { container } = await renderDesk({
      "/api/moliya/provider": {
        ok: true,
        leads: [{ ...LEAD, product: HOSTILE, reasons: [HOSTILE] }],
        products: [{ ...LOAN, name: HOSTILE }],
      },
    });

    expect(container.querySelector("#mlProvider")?.textContent).toContain(HOSTILE);
    expect(container.querySelector("#mlProvider img")).toBeNull();
  });

  it("answers a lead with an offer on that request", async () => {
    const { container, calls } = await renderDesk({ "/api/moliya/offer": { ok: true } });

    fireEvent.click(container.querySelector('[data-offer="r7"]')!);
    expect(drawer()?.querySelector<HTMLInputElement>("#ofAmount")?.value).toBe("4000");
    typeInto(drawer()!, "#ofRate", "24");
    fireEvent.submit(drawer()!.querySelector("#mlOfferForm")!);

    expect(await screen.findByText(uz("ml_offer_ok"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/moliya/offer")[0]).toMatchObject({
      requestId: "r7",
      amount: "4000",
      currency: "USD",
      ratePct: "24",
      tenor: "18",
    });
  });

  it("publishes a finance product and reloads the desk", async () => {
    const { container, calls } = await renderDesk({ "/api/moliya/product": { ok: true } });
    typeInto(container, "#mpName", "Lizing");
    typeInto(container, "#mpRate", "22-26%");
    fireEvent.click(container.querySelector("#mpSharia")!);

    fireEvent.submit(container.querySelector("#mlProdForm")!);

    expect(await screen.findByText(uz("ml_save_ok"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/moliya/product")).toEqual([
      {
        name: "Lizing",
        category: "banking",
        instrument: "",
        summary: "",
        minAmount: "",
        maxAmount: "",
        currency: "UZS",
        tenorMin: "",
        tenorMax: "",
        rate: "22-26%",
        feeModel: "",
        sla: "",
        collateral: "",
        eligibility: "",
        docs: "",
        licence: "",
        sharia: true,
      },
    ]);
    await waitFor(() => expect(bodiesSentTo(calls, "/api/moliya/provider")).toHaveLength(2));
  });

  it("says so when the product could not be saved", async () => {
    const { container } = await renderDesk({ "/api/moliya/product": 500 });

    fireEvent.submit(container.querySelector("#mlProdForm")!);

    expect(await screen.findByText(uz("ml_save_fail"))).toBeTruthy();
  });

  it("hides the desk when the server does not accept the session as a company", async () => {
    signInAs("company", COMPANY_USER);

    const { container } = await renderCabinet({
      "/api/moliya/provider": refused(401, { error: "company_login_required" }),
    });

    expect(container.querySelector("#mlProvider")).toBeNull();
  });

  it("ends the session on sign-out and takes the desk away", async () => {
    const { container } = await renderDesk();

    fireEvent.click(container.querySelector("#mlOut")!);

    await waitFor(() => expect(container.querySelector("#mlIn")).not.toBeNull());
    expect(auth.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container.querySelector("#mlProvider")).toBeNull());
  });
});

describe("MoliyaPage cabinet for another kind of account", () => {
  it("treats a signed-in buyer as no company: sign-in offered, no desk asked for", async () => {
    signInAs("buyer", { id: "b1", name: "Xaridor" });

    const { container, calls } = await renderCabinet(COMPANY_ROUTES);

    expect(container.querySelector("#mlLogin")).not.toBeNull();
    expect(container.querySelector("#mlProvider")).toBeNull();
    expect(urlsOf(calls)).not.toContain("/api/moliya/provider");
  });
});
