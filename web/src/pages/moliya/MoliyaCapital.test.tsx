import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused } from "../../shell/cabinet/testApi";
import { dialogs } from "../../shell/dialogs";
import { setTestSession } from "../../test/fakeSession";
import { HOSTILE } from "../../test/renderPage";
import { drawer, openTab, renderMoliya, typeInto, urlsOf, uz } from "./testKit";
import type { ApiRoute, Routes } from "./testKit";

const PROJECT = {
  id: "j1",
  name: "Paxta klasteri",
  gate: "G2",
  sector: "Agro",
  summary: "Qayta ishlash",
  capex: 900,
  currency: "USD",
  ask: 500,
  readiness: 60,
};
const STARTUP = { id: "s1", name: "Tezkor", stage: "seed", pitch: "Yetkazib berish", founders: ["Ali", "Vali"] };
const INVESTOR = { id: "i1", name: "Silk Capital", type: "vc", verified: true, sectors: ["Agro"], stages: ["seed"] };
const IDEA = { id: "d1", title: "Suv tejash", teaser: "Tomchilatib sug'orish", model: "license", author: "Muallif" };
const TEASER = { ok: true, idea: IDEA, ndaSigned: false, notice: "Maxfiy qism NDA dan keyin ochiladi" };
const VISITOR = { guest: { email: "ali@example.uz", name: "Ali" } };

async function renderCapital(routes: Routes = {}) {
  const view = await renderMoliya({ "/api/moliya/projects": { items: [PROJECT] }, ...routes });
  openTab("ml_tab_capital");
  await screen.findByText("Paxta klasteri");
  return view;
}

async function renderSegment(segment: string, routes: Routes) {
  const view = await renderCapital(routes);
  fireEvent.click(view.container.querySelector(`#mlCapSeg [data-value="${segment}"]`)!);
  return view;
}

describe("MoliyaPage capital market", () => {
  it("lists projects with their gate, readiness and count", async () => {
    const { container } = await renderCapital();

    expect(container.querySelectorAll("#mlCapGrid .mk-card")).toHaveLength(1);
    expect(container.querySelector("#mlCapCount")?.textContent).toBe(uz("ml_cap_count").replace("{n}", "1"));
    expect(screen.getByText("G2")).toBeTruthy();
    expect(container.querySelector("#mlCapGrid .mk-card-foot")?.textContent).toContain(`${uz("ml_readiness")} 60%`);
  });

  it("invites the first record when a list is empty or cannot be loaded", async () => {
    const { container } = await renderSegment("startups", { "/api/moliya/startups": 500 });

    await waitFor(() => expect(container.querySelector("#mlCapGrid .mk-empty")?.textContent).toBe(uz("ml_cap_empty")));
    expect(container.querySelector("#mlCapF #suName")).not.toBeNull();
  });

  it("lists investors as cards that do not open", async () => {
    const { container } = await renderSegment("investors", { "/api/moliya/investors": { items: [INVESTOR] } });

    expect(await screen.findByText("Silk Capital")).toBeTruthy();
    expect(screen.getByText(uz("ml_verified"))).toBeTruthy();
    expect(container.querySelector("#mlCapGrid [role=button]")).toBeNull();
  });

  it("renders hostile project values as text", async () => {
    const { container } = await renderMoliya({
      "/api/moliya/projects": { items: [{ id: "x", name: HOSTILE, gate: HOSTILE, sector: HOSTILE, summary: HOSTILE }] },
    });

    openTab("ml_tab_capital");

    await screen.findAllByText(HOSTILE);
    expect(container.querySelector("#mlCapGrid img")).toBeNull();
  });

  it("opens a project with its gate rail and the investors matched to it", async () => {
    const { calls } = await renderCapital({
      "/api/moliya/match?kind=project&id=j1": {
        ok: true,
        matches: [{ score: 77, reasons: ["Sektor mos"], investor: { name: HOSTILE, type: "vc" } }],
      },
    });

    fireEvent.click(screen.getByText("Paxta klasteri"));

    await waitFor(() => expect(drawer()?.textContent).toContain("Sektor mos"));
    expect(drawer()?.querySelector(".mk-step.is-now")?.textContent).toBe("G2");
    expect(drawer()?.querySelectorAll(".mk-step.is-done")).toHaveLength(2);
    expect(drawer()?.querySelector("img")).toBeNull();
    expect(urlsOf(calls)).toContain("/api/moliya/match?kind=project&id=j1");
  });

  it("asks for a startup's investors by its own kind and says when none match", async () => {
    const { calls } = await renderSegment("startups", { "/api/moliya/startups": { items: [STARTUP] } });

    fireEvent.click(await screen.findByText("Tezkor"));

    await waitFor(() => expect(drawer()?.textContent).toContain(uz("ml_no_match")));
    expect(drawer()?.textContent).toContain("Ali, Vali");
    expect(drawer()?.querySelector(".mk-railbar")).toBeNull();
    expect(urlsOf(calls)).toContain("/api/moliya/match?kind=startup&id=s1");
  });
});

describe("MoliyaPage capital publishing", () => {
  it("publishes a project under the visitor's contact details and reloads the list", async () => {
    setTestSession(VISITOR);
    const { container, calls } = await renderCapital({ "/api/moliya/project": { ok: true } });
    /* Production sends the person's name over the form's own name field; the port keeps that. */
    typeInto(container, "#cpName", "Paxta klasteri 2");
    typeInto(container, "#cpSector", "Agro");
    typeInto(container, "#cpCapex", "900");

    fireEvent.submit(container.querySelector("#mlCapF")!);

    expect(await screen.findByText(uz("ml_save_ok"))).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/moliya/project")).toEqual([
      {
        name: "Ali",
        sector: "Agro",
        region: "",
        summary: "",
        capex: "900",
        opex: "",
        revenue: "",
        currency: "USD",
        irr: "",
        npv: "",
        dscr: "",
        ask: "",
        jobs: "",
        risks: "",
        email: "ali@example.uz",
      },
    ]);
    await waitFor(() => expect(urlsOf(calls).filter(url => url === "/api/moliya/projects")).toHaveLength(2));
    expect(container.querySelector<HTMLInputElement>("#cpSector")?.value).toBe("");
  });

  it("asks for an e-mail when the server does not know the visitor", async () => {
    const { container } = await renderCapital({ "/api/moliya/project": refused(401, { error: "identify_first" }) });

    fireEvent.submit(container.querySelector("#mlCapF")!);

    expect(await screen.findByText(uz("ml_need_email"))).toBeTruthy();
  });

  it("says so when a record could not be saved", async () => {
    const { container } = await renderCapital({ "/api/moliya/project": refused(400, { error: "name_required" }) });

    fireEvent.submit(container.querySelector("#mlCapF")!);

    expect(await screen.findByText(uz("ml_save_fail"))).toBeTruthy();
  });

  it("sends an investor's stages and instruments as lists, empty when none is ticked", async () => {
    const { container, calls } = await renderSegment("investors", { "/api/moliya/investor": { ok: true } });
    await waitFor(() => expect(container.querySelector("#ivType")).not.toBeNull());
    fireEvent.click(container.querySelector('.ivStage[value="seed"]')!);
    fireEvent.click(container.querySelector('.ivStage[value="growth"]')!);

    fireEvent.submit(container.querySelector("#mlCapF")!);

    await waitFor(() => expect(bodiesSentTo(calls, "/api/moliya/investor")).toHaveLength(1));
    expect(bodiesSentTo(calls, "/api/moliya/investor")[0]).toMatchObject({
      type: "angel",
      currency: "USD",
      stages: ["seed", "growth"],
      instruments: [],
    });
  });

  it("posts an idea with its confidential half and no operation code", async () => {
    const { container, calls } = await renderSegment("ideas", { "/api/moliya/idea": { ok: true } });
    await waitFor(() => expect(container.querySelector("#idTitle")).not.toBeNull());
    typeInto(container, "#idTitle", "Suv tejash");
    typeInto(container, "#idConfidential", "Formula");

    fireEvent.submit(container.querySelector("#mlCapF")!);

    await waitFor(() => expect(bodiesSentTo(calls, "/api/moliya/idea")).toHaveLength(1));
    const body = bodiesSentTo(calls, "/api/moliya/idea")[0];
    expect(body).toMatchObject({ title: "Suv tejash", confidential: "Formula", model: "sale", ipStatus: "" });
    expect(body).not.toHaveProperty("op");
  });
});

describe("MoliyaPage idea exchange", () => {
  async function openIdea(answer: ApiRoute) {
    const view = await renderSegment("ideas", {
      "/api/moliya/ideas": { items: [IDEA] },
      "/api/moliya/idea": answer,
    });
    fireEvent.click(await screen.findByText("Suv tejash"));
    return view;
  }

  it("shows the teaser behind an NDA gate", async () => {
    const { calls } = await openIdea(TEASER);

    await waitFor(() => expect(drawer()?.querySelector("#mlNda")).not.toBeNull());
    expect(drawer()?.textContent).toContain("Maxfiy qism NDA dan keyin ochiladi");
    expect(bodiesSentTo(calls, "/api/moliya/idea")).toEqual([{ op: "open", id: "d1", email: "", name: "" }]);
  });

  it("asks an unknown visitor for an e-mail instead of opening the idea", async () => {
    await openIdea(refused(401, { error: "identify_first" }));

    await waitFor(() => expect(drawer()?.querySelector(".mk-empty")?.textContent).toBe(uz("ml_need_email")));
  });

  it("will not record an NDA for a visitor without an e-mail", async () => {
    const confirm = vi.spyOn(dialogs, "confirm").mockResolvedValue(true);
    const { calls } = await openIdea(TEASER);
    await waitFor(() => expect(drawer()?.querySelector("#mlNda")).not.toBeNull());

    fireEvent.click(drawer()!.querySelector("#mlNda")!);

    await waitFor(() => expect(drawer()?.querySelector(".mk-msg.is-err")?.textContent).toBe(uz("ml_need_email")));
    expect(confirm).not.toHaveBeenCalled();
    expect(bodiesSentTo(calls, "/api/moliya/idea")).toHaveLength(1);
  });

  it("records the NDA once it is confirmed and opens the confidential half as text", async () => {
    setTestSession(VISITOR);
    vi.spyOn(dialogs, "confirm").mockResolvedValue(true);
    let isSigned = false;
    const { calls } = await openIdea(body => {
      if (body.op === "nda") isSigned = true;
      return isSigned ? { ok: true, idea: IDEA, ndaSigned: true, confidential: HOSTILE, terms: "5% royalty" } : TEASER;
    });
    await waitFor(() => expect(drawer()?.querySelector("#mlNda")).not.toBeNull());

    fireEvent.click(drawer()!.querySelector("#mlNda")!);

    await waitFor(() => expect(drawer()?.textContent).toContain("5% royalty"));
    expect(drawer()?.textContent).toContain(HOSTILE);
    expect(drawer()?.querySelector("img")).toBeNull();
    expect(bodiesSentTo(calls, "/api/moliya/idea").map(body => body.op)).toEqual(["open", "nda", "open"]);
    expect(bodiesSentTo(calls, "/api/moliya/idea")[1]).toEqual({ op: "nda", id: "d1", email: "ali@example.uz", name: "Ali" });
  });

  it("leaves the idea closed when the NDA is not confirmed", async () => {
    setTestSession(VISITOR);
    vi.spyOn(dialogs, "confirm").mockResolvedValue(false);
    const { calls } = await openIdea(TEASER);
    await waitFor(() => expect(drawer()?.querySelector("#mlNda")).not.toBeNull());

    fireEvent.click(drawer()!.querySelector("#mlNda")!);

    await waitFor(() => expect(dialogs.confirm).toHaveBeenCalledWith(uz("ml_nda_confirm")));
    expect(bodiesSentTo(calls, "/api/moliya/idea")).toHaveLength(1);
  });
});

describe("MoliyaPage capital intelligence", () => {
  const INTEL = {
    headline: { providers: 6, products: 14, staleProducts: 2, investors: 3, requests: 9, fundingGapPct: 40 },
    demandMap: { bySector: [{ label: HOSTILE, requests: 5, answered: 3, gap: 40 }] },
    termsMonitor: { ratePct: { p25: 20, median: 22, p75: 25 }, note: "Kamida 3 ta taklif" },
    projectPipeline: [{ gate: "G0", label: "G'oya", n: 4 }],
    investorAppetite: { bySector: [{ label: "Agro", n: 2 }] },
    supply: { byCategory: [{ label: "banking", n: 8 }] },
    startupPulse: { byStage: [] },
    ideaExchange: { conversion: 25, ndas: 7 },
    privacy: "Faqat agregat ko'rsatkichlar",
  };

  it("shows the aggregates with sector names as text", async () => {
    const { container } = await renderMoliya({ "/api/moliya/intel": INTEL });

    openTab("ml_tab_intel");

    expect(await screen.findByText("Faqat agregat ko'rsatkichlar")).toBeTruthy();
    expect(container.querySelectorAll("#mlIntel .mk-kpi")).toHaveLength(6);
    expect(screen.getByText("3/5 · 40% gap")).toBeTruthy();
    expect(screen.getByText(`2 ${uz("ml_stale")}`)).toBeTruthy();
    expect(container.querySelector("#mlIntel")?.textContent).toContain(uz("ml_cat_banking"));
    expect(container.querySelectorAll("#mlIntel tbody tr")).toHaveLength(1);
    expect(container.querySelector("#mlIntel img")).toBeNull();
  });

  it("shows empty tables rather than hanging when the request fails", async () => {
    const { container } = await renderMoliya({ "/api/moliya/intel": 500 });

    openTab("ml_tab_intel");

    await waitFor(() => expect(container.querySelectorAll("#mlIntel .mk-kpi")).toHaveLength(6));
    expect(screen.getAllByText(uz("mk_nodata")).length).toBeGreaterThan(1);
  });
});
