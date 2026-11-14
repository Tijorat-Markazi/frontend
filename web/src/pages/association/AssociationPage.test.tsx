import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused, stubCabinetApi } from "../../shell/cabinet/testApi";
import { dialogs } from "../../shell/dialogs";
import { navigate } from "../../shell/navigate";
import { HOSTILE, renderPage, setSearch } from "../../test/renderPage";
import { AssociationPage } from "./AssociationPage";
import { COMPANIES, openCabinet, openView, signIn } from "./testCabinet";
import { AT } from "./text";

describe("AssociationPage cabinet", () => {
  it("shows the dashboard figures, the waiting applications and hostile names as text", async () => {
    const { container } = await openCabinet();

    const cards = [...container.querySelectorAll(".admin-card")].map(card => card.textContent);
    expect(cards).toEqual([
      `${AT.d_companies[0]}2▲`,
      `${AT.d_products[0]}1🛍️`,
      `${AT.d_with[0]}1 / 2`,
      expect.stringContaining(AT.d_meeting[0]),
    ]);
    await waitFor(() => expect(container.querySelector(".co-badge")?.textContent).toBe("2"));
    await waitFor(() => expect(cards.length && container.querySelectorAll(".admin-card")[3].textContent).toBe(`${AT.d_meeting[0]}${AT.yes[0]}`));
    expect(screen.getByRole("img", { name: new RegExp(AT.flow[0]) })).toBeTruthy();
    expect(screen.getByText(HOSTILE)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("#aiNav")?.getAttribute("href")).toBe("assistant.html");
  });

  it("follows the language switch", async () => {
    const { container } = await openCabinet();

    fireEvent.click(container.querySelector("#langBtn")!);

    expect(screen.getByRole("heading", { level: 1, name: AT.nav_dash[1] })).toBeTruthy();
    expect(container.querySelector("#asBrandSub")?.textContent).toBe("Хлопок");
    expect(screen.getByRole("button", { name: AT.logout[1] })).toBeTruthy();
  });

  it("adds a company through the form", async () => {
    const added = [...COMPANIES, { id: "c3", name: "Gamma", sector: "IT", login: "gamma", showroom: [] }];
    const { calls, container } = await openCabinet({ "/api/assoc/companies": { ok: true, companies: added } });
    openView(AT.nav_comp[0]);

    fireEvent.change(screen.getByPlaceholderText(AT.ph_name[0]), { target: { value: " Gamma " } });
    fireEvent.change(container.querySelector("#cmp-sector")!, { target: { value: "IT" } });
    fireEvent.change(container.querySelector("#cmp-login")!, { target: { value: " gamma " } });
    fireEvent.change(screen.getByPlaceholderText(AT.c_pass[0]), { target: { value: "pw-12345" } });
    fireEvent.submit(container.querySelector("#cmpForm")!);

    expect(await screen.findByText("Gamma")).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/assoc/companies")).toEqual([
      { op: "add", name: "Gamma", sector: "IT", clogin: "gamma", cpassword: "pw-12345" },
    ]);
    expect(screen.getByRole("heading", { name: `${AT.nav_comp[0]} (3)` })).toBeTruthy();
    expect(screen.getByPlaceholderText<HTMLInputElement>(AT.ph_name[0]).value).toBe("");
  });

  it("explains a taken login and keeps what was typed", async () => {
    const { container } = await openCabinet({ "/api/assoc/companies": refused(409, { error: "login exists" }) });
    openView(AT.nav_comp[0]);

    fireEvent.change(container.querySelector("#cmp-login")!, { target: { value: "alfa" } });
    fireEvent.change(container.querySelector("#cmp-pass")!, { target: { value: "pw" } });
    fireEvent.submit(container.querySelector("#cmpForm")!);

    expect(await screen.findByText(AT.taken[0])).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#cmp-login")?.value).toBe("alfa");
  });

  it("opens a company's figures and issues a new password once", async () => {
    vi.spyOn(dialogs, "confirm").mockResolvedValue(true);
    const { calls } = await openCabinet({ "/api/assoc/companies": { ok: true, password: "fresh-pass-1", once: true } });
    openView(AT.nav_comp[0]);

    fireEvent.click(screen.getByRole("link", { name: "Alfa MChJ" }));
    expect(screen.getByRole("heading", { level: 2, name: "Alfa MChJ" })).toBeTruthy();
    expect(screen.getByText("5$")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: AT.pw_reset[0] }));

    expect(await screen.findByText("fresh-pass-1")).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/assoc/companies")).toEqual([{ op: "pw", id: "c1" }]);

    fireEvent.click(screen.getByRole("button", { name: AT.cd_back[0] }));
    expect(screen.queryByText("fresh-pass-1")).toBeNull();
  });

  it("lists applications and approves one after confirmation", async () => {
    vi.spyOn(dialogs, "confirm").mockResolvedValue(true);
    const application = {
      id: "r1", status: "pending", name: HOSTILE, ref: "REG-1", login: "newco", contactName: "Ali", role: "CEO",
      email: "ali@newco.uz", phone: "+998 90 111", website: "javascript:alert(1)", created: Date.now(),
    };
    const { calls, container } = await openCabinet({
      "/api/register/list": { ok: true, counts: { pending: 1 }, items: [application] },
      "/api/register/decide": { ok: true },
    });
    openView(AT.nav_regs[0]);

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(screen.getByText("Ali · CEO")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    const links = [...container.querySelectorAll(".rq-contact a")].map(link => link.getAttribute("href"));
    expect(links).toEqual(["mailto:ali@newco.uz", "tel:+99890111"]);

    fireEvent.click(screen.getByRole("button", { name: AT.rq_approve[0] }));

    await waitFor(() => expect(bodiesSentTo(calls, "/api/register/decide")).toEqual([{ id: "r1", action: "approve" }]));
    expect(dialogs.confirm).toHaveBeenCalledWith(AT.rq_confirm[0]);
  });

  it("requires a reason to reject, and reports a refused decision", async () => {
    const prompt = vi.spyOn(dialogs, "prompt").mockResolvedValueOnce("  ").mockResolvedValueOnce(" No licence ");
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    const { calls } = await openCabinet({
      "/api/register/list": { ok: true, counts: { pending: 1 }, items: [{ id: "r1", status: "pending", name: "Newco" }] },
      "/api/register/decide": refused(400, { error: "bad" }),
    });
    openView(AT.nav_regs[0]);
    const reject = await screen.findByRole("button", { name: AT.rq_reject[0] });

    fireEvent.click(reject);
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(bodiesSentTo(calls, "/api/register/decide")).toEqual([]);

    fireEvent.click(reject);

    await waitFor(() => expect(alert).toHaveBeenCalledWith(AT.rq_fail[0]));
    expect(bodiesSentTo(calls, "/api/register/decide")).toEqual([{ id: "r1", action: "reject", reason: "No licence" }]);
  });

  it("says so when the applications cannot be loaded", async () => {
    await openCabinet({ "/api/register/list": 500 });
    openView(AT.nav_regs[0]);

    expect(await screen.findByText(AT.rq_fail[0])).toBeTruthy();
  });

  it("shows the month's appeals and writes an official letter", async () => {
    const { calls } = await openCabinet({
      "/api/assoc/questions": {
        ym: "2026-03", months: ["2026-03", "2026-02"],
        users: [{ label: "Alfa MChJ", count: 3, type: "company", key: "c1" }],
        report: [{ question: HOSTILE, count: 2, companies: ["Alfa MChJ", "Beta"], repeated: true }],
      },
      "/api/assoc/letter": { ok: true, letter: { recipientLabel: "Alfa MChJ", body: "Hurmatli <b>rahbar</b>" } },
    });
    openView(AT.nav_quest[0]);

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(screen.getByText("Alfa MChJ, Beta")).toBeTruthy();
    expect(screen.getByText(AT.q_repeat[0])).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: AT.q_makeletter[0] }));

    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText("Hurmatli <b>rahbar</b>")).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/assoc/letter")).toEqual([{ type: "company", key: "c1", ym: "2026-03", lang: "uz" }]);

    fireEvent.click(within(modal).getByRole("button", { name: "✕" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the news with safe links only", async () => {
    const { container } = await openCabinet({
      "/api/assoc/news": { items: [{ title: "Bozor", tier: "global", url: "https://n.uz/1", source: "N" }, { title: HOSTILE, url: "javascript:x" }] },
    });
    openView(AT.nav_news[0]);

    expect(await screen.findByText("Bozor")).toBeTruthy();
    expect(screen.getByText(AT.news_tier_global[0])).toBeTruthy();
    expect([...container.querySelectorAll(".news-item a")].map(link => link.getAttribute("href"))).toEqual(["https://n.uz/1"]);
  });

  it("shows the monthly report and downloads it with the month in the address", async () => {
    vi.spyOn(dialogs, "toast").mockImplementation(() => undefined);
    const { calls, container } = await openCabinet({
      "/api/assoc/report": { ym: "2026-03", companyCount: 1, questions: 4, companies: [{ name: "Alfa MChJ", products: 1, questions: 4 }] },
    });
    openView(AT.nav_report[0]);

    expect(await screen.findByRole("cell", { name: "Alfa MChJ" })).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#repMonth")?.value).toBe("2026-03");
    /* a button that fetches through the session, the way production reads ?ym= */
    expect(container.querySelector("#repDl")?.tagName).toBe("BUTTON");
    fireEvent.click(container.querySelector("#repDl")!);
    await waitFor(() => expect(calls.at(-1)).toEqual({ url: "/api/assoc/report.doc?ym=2026-03", method: "GET", body: {} }));
  });

  it("supports a member's appeal with a note", async () => {
    vi.spyOn(dialogs, "toast").mockImplementation(() => undefined);
    const appeal = { id: "ap/1", subject: "Bojxona", stage: "new", companyName: "Alfa", agency: "DBQ", body: HOSTILE, history: [{ stage: "new", by: "Alfa" }] };
    const supported = { ...appeal, stage: "assoc", history: [...appeal.history, { stage: "assoc", by: "Karimov", note: "Ma'qul" }] };
    const { calls } = await openCabinet({
      "/api/assoc/appeals": body => ({ items: [body.op === "stage" ? supported : appeal] }),
    });
    openView(AT.nav_appeals[0]);

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: AT.ap_doc[0] }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ url: "/api/appeal/doc?id=ap%2F1", method: "GET", body: {} }));
    fireEvent.change(screen.getByPlaceholderText(AT.ap_note[0]), { target: { value: "Ma'qul" } });
    fireEvent.click(screen.getByRole("button", { name: AT.ap_support[0] }));

    expect(await screen.findByText("Karimov · Ma'qul")).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/assoc/appeals")[1]).toEqual({ op: "stage", id: "ap/1", stage: "assoc", note: "Ma'qul" });
    expect(screen.queryByRole("button", { name: AT.ap_support[0] })).toBeNull();
  });

  it("schedules a meeting and refuses a link that is not a web address", async () => {
    const meeting = { id: "m1", title: "Kengash", datetime: "2026-04-01T10:00", link: "https://meet.example/x", provider: "meet-bot" };
    const { calls, container } = await openCabinet({
      "/api/assoc/conference": body => (body.title ? { meetings: [meeting], meeting } : { meetings: [] }),
    });
    openView(AT.nav_conf[0]);
    expect(await screen.findByText(AT.conf_none_list[0])).toBeTruthy();

    fireEvent.change(container.querySelector("#conf-title")!, { target: { value: " Kengash " } });
    fireEvent.change(container.querySelector("#conf-dt")!, { target: { value: "2026-04-01T10:00" } });
    fireEvent.change(container.querySelector("#conf-link")!, { target: { value: "ftp://x" } });
    fireEvent.submit(container.querySelector("#confForm")!);
    expect(screen.getByText(AT.conf_link_err[0])).toBeTruthy();

    fireEvent.change(container.querySelector("#conf-link")!, { target: { value: "" } });
    fireEvent.submit(container.querySelector("#confForm")!);

    expect(await screen.findByText(AT.conf_meet_ready[0])).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/assoc/conference")[1]).toEqual({ title: "Kengash", datetime: "2026-04-01T10:00", link: "", desc: "" });
    expect(screen.getByRole("link", { name: AT.conf_join[0] }).getAttribute("href")).toBe("/api/conference/join?id=m1");
    expect(screen.getByText(AT.conf_meet_auto[0])).toBeTruthy();
  });

  it("opens the Business ID and rights panels on the cookie session alone", async () => {
    const { calls } = await openCabinet({
      "/api/business-id/contact": { ok: true, bizId: "TM-1", fields: ["phone"], contact: {} },
      "/api/legal/export": { ok: true, data: {} },
    });

    openView(AT.nav_bizid[0]);
    expect(await screen.findByText("TM-1")).toBeTruthy();
    openView(AT.nav_legal[0]);

    await waitFor(() => expect(bodiesSentTo(calls, "/api/legal/export")).toEqual([{}]));
  });

  it("opens the group chat as its own page", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    await openCabinet();

    openView(AT.nav_groups[0]);

    expect(goTo).toHaveBeenCalledWith("chat.html");
  });
});

describe("AssociationPage public view", () => {
  afterEach(() => setSearch(""));

  it("shows the association and its members, even to a signed-in chairman", async () => {
    signIn();
    setSearch("?id=a%2F1");
    stubCabinetApi({
      "/api/assoc/public?id=a%2F1": {
        assoc: { id: "a/1", name: "Paxta", chairman: HOSTILE },
        companies: [{ name: HOSTILE, sector: "Paxta", products: 3, bizId: "TM 1" }, { name: "Beta" }],
      },
    });

    const { container } = renderPage(<AssociationPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Paxta" })).toBeTruthy();
    expect(container.querySelector("#pubChair")?.textContent).toBe(`Rahbar: ${HOSTILE}`);
    expect(container.querySelector("#pubCount")?.textContent).toBe("2");
    expect(container.querySelector("img")).toBeNull();
    expect([...container.querySelectorAll("#pubCompanies a")].map(link => link.getAttribute("href"))).toEqual([
      "korxona.html?id=TM%201",
      "biznes-id.html?id=TM%201",
    ]);
    expect(container.querySelector(".admin-shell")).toBeNull();
  });

  it("returns to the directory when the association does not exist", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setSearch("?id=zz");
    stubCabinetApi({});

    renderPage(<AssociationPage />);

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("associations.html"));
  });
});
