/*
 * The cabinet of a visitor the session knows by e-mail. Every test uses the
 * same address: the kit remembers a saved one for the life of the module.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bodiesSentTo } from "../../shell/cabinet/testApi";
import { auth } from "../../shell/session";
import { setTestSession } from "../../test/fakeSession";
import { HOSTILE } from "../../test/renderPage";
import { drawer, openTab, renderMoliya, REQUEST, REQUEST_ROUTES, typeInto, urlsOf, uz } from "./testKit";
import type { Routes } from "./testKit";

const EMAIL = "ali@example.uz";
const PASSPORT = {
  ownerName: "Alfa MChJ",
  sector: "Agro",
  currency: "USD",
  need: 250000,
  employees: 0,
  docs: ["Ustav", "Balans"],
  purpose: "Uskuna",
};
const READINESS = {
  score: 43,
  note: "Bu kredit reytingi emas",
  blocks: [
    { key: "Financials", ok: true, hint: "" },
    { key: "Documents", ok: false, hint: HOSTILE },
  ],
};
const CABINET_ROUTES = {
  "/api/moliya/passport": { ok: true, passport: PASSPORT, readiness: READINESS },
  "/api/moliya/request/mine": { ok: true, items: [REQUEST] },
};

async function renderCabinet(routes: Routes = CABINET_ROUTES) {
  setTestSession({ guest: { email: EMAIL, name: "Ali" } });
  const view = await renderMoliya(routes);
  openTab("ml_tab_cabinet");
  await waitFor(() => expect(view.container.querySelector("#mlCabinet .mk-bento")).not.toBeNull());
  return view;
}

describe("MoliyaPage cabinet passport", () => {
  it("asks for the visitor's passport and requests by e-mail, and for no provider desk", async () => {
    const { calls } = await renderCabinet();

    expect(bodiesSentTo(calls, "/api/moliya/passport")[0]).toMatchObject({ op: "get", email: EMAIL });
    expect(bodiesSentTo(calls, "/api/moliya/request/mine")[0]).toMatchObject({ email: EMAIL });
    expect(urlsOf(calls)).not.toContain("/api/moliya/provider");
  });

  it("shows the readiness score with each block's missing step as text", async () => {
    const { container } = await renderCabinet();

    expect(container.querySelector("#mlCabinet .mk-score-big b")?.textContent).toBe("43");
    expect(container.querySelectorAll("#mlCabinet .mk-meter")).toHaveLength(2);
    expect(screen.getByText("Bu kredit reytingi emas")).toBeTruthy();
    expect(screen.getByText(HOSTILE)).toBeTruthy();
    expect(container.querySelector("#mlCabinet .mk-meter img")).toBeNull();
  });

  it("fills the form from the stored passport and leaves zero figures blank", async () => {
    const { container } = await renderCabinet();
    const value = (selector: string): string | undefined =>
      container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value;

    expect(value("#fpName")).toBe("Alfa MChJ");
    expect(value("#fpNeed")).toBe("250000");
    expect(value("#fpEmployees")).toBe("");
    expect(value("#fpDocs")).toBe("Ustav, Balans");
    expect(value("#fpCurrency")).toBe("USD");
  });

  it("starts an empty passport for a visitor who has none", async () => {
    const { container } = await renderCabinet({ "/api/moliya/passport": { ok: true, passport: null, readiness: null } });

    expect(screen.getByText(uz("ml_no_passport"))).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#fpSector")?.value).toBe("");
  });

  it("saves the passport under the owner's name and reads it back", async () => {
    const { container, calls } = await renderCabinet();
    typeInto(container, "#fpRegion", "Toshkent");

    fireEvent.submit(container.querySelector("#mlPassForm")!);

    expect(await screen.findByText(uz("ml_save_ok"))).toBeTruthy();
    await waitFor(() => expect(bodiesSentTo(calls, "/api/moliya/passport")).toHaveLength(3));
    expect(bodiesSentTo(calls, "/api/moliya/passport")[1]).toEqual({
      sector: "Agro",
      region: "Toshkent",
      legalForm: "",
      founded: "",
      employees: "",
      revenue: "",
      ebitda: "",
      currency: "USD",
      need: "250000",
      tenor: "",
      collateralValue: "",
      purpose: "Uskuna",
      collateral: "",
      docs: "Ustav, Balans",
      risks: "",
      email: EMAIL,
      name: "Alfa MChJ",
    });
    expect(auth.guest).toHaveBeenCalledWith(EMAIL, "Alfa MChJ");
  });

  it("says so when the passport could not be saved", async () => {
    const { container } = await renderCabinet({
      ...CABINET_ROUTES,
      "/api/moliya/passport": body => (body.op === "get" ? CABINET_ROUTES["/api/moliya/passport"] : { ok: false }),
    });

    fireEvent.submit(container.querySelector("#mlPassForm")!);

    expect(await screen.findByText(uz("ml_save_fail"))).toBeTruthy();
  });

  it("registers a typed e-mail as the guest's contact and loads the cabinet for it", async () => {
    const { container, calls } = await renderCabinet();
    typeInto(container, "#mlEmail", ` ${EMAIL} `);

    fireEvent.click(container.querySelector("#mlSaveEmail")!);

    await waitFor(() => expect(auth.guest).toHaveBeenCalledWith(EMAIL, expect.any(String)));
    expect(bodiesSentTo(calls, "/api/moliya/passport").every(body => body.email === EMAIL)).toBe(true);
  });
});

describe("MoliyaPage cabinet requests", () => {
  it("lists the visitor's own requests with their offer count", async () => {
    const { container } = await renderCabinet();

    expect(container.querySelector('[data-openreq="r1"]')).not.toBeNull();
    expect(screen.getByText(`${uz("ml_offers")}: 1`)).toBeTruthy();
  });

  it("opens an own request with the offers it received", async () => {
    const { container } = await renderCabinet({
      ...CABINET_ROUTES,
      ...REQUEST_ROUTES,
      "/api/moliya/offers?requestId=r1": {
        ok: true,
        offers: [{ providerName: "Alfa Bank", ratePct: 22, feePct: 1, tenor: 12, allInPct: 23, bestCost: true }],
      },
    });

    fireEvent.click(container.querySelector('[data-openreq="r1"]')!);

    await waitFor(() => expect(drawer()?.querySelectorAll("tbody tr")).toHaveLength(1));
    expect(drawer()?.querySelector("#mkDrawerTitle")?.textContent).toBe(uz("ml_request"));
    expect(drawer()?.querySelector("#mlOfferBtn")).toBeNull();
  });
});

describe("MoliyaPage capital stack builder", () => {
  const STACK = {
    ok: true,
    currency: "USD",
    scenarios: [
      { name: HOSTILE, costOfCapital: "18–22%", dilution: 10, note: "Konservativ", sources: [{ label: "Bank krediti", amount: 700, pct: 70 }] },
    ],
    disclaimer: "Senariylar indikativ",
  };

  it("sends the figures without any identity and draws each scenario as text", async () => {
    const { container, calls } = await renderCabinet({ ...CABINET_ROUTES, "/api/moliya/capital-stack": STACK });
    typeInto(container, "#csAmount", "1000");
    fireEvent.click(container.querySelector("#csExporter")!);

    fireEvent.submit(container.querySelector("#mlStackForm")!);

    expect(await screen.findByText("Senariylar indikativ")).toBeTruthy();
    expect(container.querySelector("#mlStackOut .mk-rank b")?.textContent).toBe("70%");
    expect(container.querySelector("#mlStackOut img")).toBeNull();
    expect(bodiesSentTo(calls, "/api/moliya/capital-stack")).toEqual([
      {
        amount: "1000",
        currency: "USD",
        ebitda: "",
        receivables: "",
        collateral: false,
        exporter: true,
        equipment: false,
        sharia: false,
      },
    ]);
  });

  it("says so when the scenarios could not be built", async () => {
    const { container } = await renderCabinet({ ...CABINET_ROUTES, "/api/moliya/capital-stack": { error: "amount_required" } });

    fireEvent.submit(container.querySelector("#mlStackForm")!);

    expect(await screen.findByText(uz("ml_stack_fail"))).toBeTruthy();
  });
});

describe("MoliyaPage investor-ready studio", () => {
  const PACK = {
    ok: true,
    review: "AI qoralamasi",
    data: {
      teaser: { problem: "Suv tanqisligi", ask: 500000 },
      deckOutline: [{ slide: "Muammo", content: HOSTILE }],
      riskRegister: [{ severity: "high", risk: "Valyuta", mitigation: "Xedj" }],
      dataRoomChecklist: [{ item: "Ustav", required: true }],
      figures: [{ label: "MRR", value: 1200, source: "assumption" }],
    },
  };

  it("asks for a description before anything is sent", async () => {
    const { container, calls } = await renderCabinet();

    fireEvent.click(container.querySelector("#mlIrGo")!);

    expect(await screen.findByText(uz("ml_ir_need"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/copilot")).toHaveLength(0);
  });

  it("sends the description with the ask and sector to the investor-ready agent", async () => {
    const { container, calls } = await renderCabinet({ ...CABINET_ROUTES, "/api/copilot": PACK });
    typeInto(container, "#mlIrText", "Tomchilatib sug'orish loyihasi");
    typeInto(container, "#mlIrAsk", "500000");
    typeInto(container, "#mlIrSector", "Agro");

    fireEvent.click(container.querySelector("#mlIrGo")!);

    await screen.findByText("Suv tanqisligi");
    expect(bodiesSentTo(calls, "/api/copilot")[0]).toMatchObject({
      agent: "moliya.investor-ready",
      lang: "uz",
      text: "Tomchilatib sug'orish loyihasi",
      ask: "500000",
      sector: "Agro",
      email: EMAIL,
    });
  });

  it("draws the deck, risks, data room and figures as text, flagging assumed figures", async () => {
    const { container } = await renderCabinet({ ...CABINET_ROUTES, "/api/copilot": PACK });
    typeInto(container, "#mlIrText", "Loyiha");

    fireEvent.click(container.querySelector("#mlIrGo")!);

    await screen.findByText("Suv tanqisligi");
    const out = container.querySelector("#mlIrOut")!;
    expect(out.querySelector("ol li")?.textContent).toBe(`Muammo — ${HOSTILE}`);
    expect(out.textContent).toContain("[high] Valyuta — Xedj");
    expect(out.textContent).toContain("★ Ustav");
    expect(out.querySelector(".mk-chip.is-warn")?.textContent).toBe("assumption");
    expect(out.querySelector("img")).toBeNull();
  });

  it("explains when the free AI allowance is used up", async () => {
    const { container } = await renderCabinet({ ...CABINET_ROUTES, "/api/copilot": { ok: false, limit: true, error: "ai_limit" } });
    typeInto(container, "#mlIrText", "Loyiha");

    fireEvent.click(container.querySelector("#mlIrGo")!);

    expect(await screen.findByText(uz("mk_ai_limit"))).toBeTruthy();
  });
});
