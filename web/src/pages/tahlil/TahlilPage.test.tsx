import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { T_ANALYST } from "@legacy/markets-i18n.js";
import { dialogs } from "../../shell/dialogs";
import { signInAs } from "../../shell/cabinet/testApi";
import { goTo } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult } from "../../test/fakeSession";
import { HOSTILE, renderPage, stubApi } from "../../test/renderPage";
import { TahlilPage } from "./TahlilPage";

vi.mock("../../shell/navigate", () => ({ goTo: vi.fn(), replaceWith: vi.fn() }));

const uz = (key: string): string => T_ANALYST[key]![0];

const LOGIN = {
  ok: true,
  analyst: { name: "Aziza", org: "Markaz", scopes: ["bozor", "mehnat"] },
  modules: ["bozor", "moliya", "mehnat"],
};
const OVERVIEW = {
  ok: true,
  platform: { companies: 120, newCompanies: 7, associations: 4 },
  bozor: { products: 55, rfqs: 9, quotes: 6, deals: 3, inquiries: 2, matchRate: 61 },
  moliya: { providers: 5, products: 8, investors: 2, requests: 11, offers: 4, projects: 1, askedValue: 3.2e9 },
  mehnat: { vacancies: 31, seats: 40, candidates: 77, applications: 12, hires: 2, shortageIndex: null },
  funnels: [{ module: "bozor", steps: [{ label: "rfq", n: 9 }, { label: HOSTILE, n: 1 }] }],
};
const SEGMENT = {
  ok: true,
  dimension: "sector",
  dimensions: ["sector", "region"],
  note: "Agregat",
  rows: [
    { label: HOSTILE, n: 5, demand: 3, ratio: 0.6, price: { suppressed: true, stats: null } },
    { label: "Agro", n: 9, demand: 4, ratio: 0.4, price: { suppressed: false, stats: { p25: 10, median: 20, p75: 30 } } },
  ],
};
const DAY = 86_400_000;
const SERIES = {
  ok: true,
  metric: "products",
  metrics: ["products", "rfqs"],
  bucket: "week",
  total: 14,
  trendPct: -25,
  points: [
    { from: DAY, to: 7 * DAY, n: 4 },
    { from: 7 * DAY, to: 14 * DAY, n: 0 },
    { from: 14 * DAY, to: 21 * DAY, n: 10 },
  ],
};
const ROUTES = {
  "/api/analyst/login": LOGIN,
  "/api/analyst/overview": OVERVIEW,
  "/api/analyst/segment": SEGMENT,
  "/api/analyst/series": SERIES,
};

type FetchStub = ReturnType<typeof vi.fn>;

const postsTo = (path: string): Record<string, unknown>[] =>
  (fetch as unknown as FetchStub).mock.calls
    .filter(([url, options]) => url === path && options)
    .map(([, options]) => JSON.parse((options as { body: string }).body) as Record<string, unknown>);

function signIn(login: string, password: string): void {
  fireEvent.change(screen.getByLabelText("Login"), { target: { value: login } });
  fireEvent.change(screen.getByLabelText("Parol"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: uz("an_login_btn") }));
}

/** Opens the cabinet on the cookie session of an analyst who signed in earlier. */
async function renderCabinet(routes: Record<string, unknown> = {}) {
  signInAs("analyst", { id: "an1", name: "Aziza" });
  stubApi({ ...ROUTES, ...routes });
  const view = renderPage(<TahlilPage />);
  await screen.findByRole("button", { name: uz("an_logout") });
  return view;
}

const openView = (key: string): void => {
  fireEvent.click(screen.getByRole("button", { name: uz(key) }));
};

describe("TahlilPage sign-in", () => {
  it("opens the cabinet for a session that already holds the analyst role", async () => {
    const { container } = await renderCabinet();

    expect(await screen.findByText(uz("an_k_companies"))).toBeTruthy();
    expect(auth.login).not.toHaveBeenCalled();
    expect(postsTo("/api/analyst/login")).toEqual([{}]);
    expect(container.querySelector("#anBrandSub")?.textContent).toBe("Markaz");
    expect(document.title).toBe("Aziza — TIJORAT MARKAZI");
  });

  it("shows the form to a guest and to another role, without asking for the account", async () => {
    stubApi(ROUTES);
    const guest = renderPage(<TahlilPage />);
    expect(await screen.findByRole("heading", { name: uz("an_title") })).toBeTruthy();
    guest.unmount();

    signInAs("company", { id: "c1" });
    renderPage(<TahlilPage />);

    expect(await screen.findByRole("heading", { name: uz("an_title") })).toBeTruthy();
    expect(postsTo("/api/analyst/login")).toEqual([]);
  });

  it("opens the cabinet for the administrator, who needs no analyst account", async () => {
    signInAs("admin", { id: "admin" });
    stubApi(ROUTES);

    renderPage(<TahlilPage />);

    expect(await screen.findByRole("button", { name: uz("an_logout") })).toBeTruthy();
    expect(auth.login).not.toHaveBeenCalled();
    expect(postsTo("/api/analyst/login")).toEqual([{}]);
  });

  it("shows the form when the server does not know the analyst behind the session", async () => {
    signInAs("analyst", { id: "an1" });
    stubApi({ ...ROUTES, "/api/analyst/login": 401 });

    renderPage(<TahlilPage />);

    expect(await screen.findByRole("heading", { name: uz("an_title") })).toBeTruthy();
  });

  it("signs in through the session and names the analyst", async () => {
    setLoginResult({ role: "analyst", target: "tahlil.html", user: { id: "an1" } });
    stubApi(ROUTES);
    const { container } = renderPage(<TahlilPage />);
    await screen.findByRole("heading", { name: uz("an_title") });

    signIn("  tahlil ", "secret-pass");

    expect(await screen.findByText(uz("an_k_companies"))).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("tahlil", "secret-pass");
    expect(postsTo("/api/analyst/login")).toEqual([{}]);
    expect(container.querySelector("#anBrandSub")?.textContent).toBe("Markaz");
    expect(sessionStorage.length).toBe(0);
  });

  it("refuses a pair no tier accepts and clears the password", async () => {
    setLoginResult(null);
    stubApi(ROUTES);
    renderPage(<TahlilPage />);
    await screen.findByRole("heading", { name: uz("an_title") });

    signIn("tahlil", "wrong");

    expect(await screen.findByText(uz("an_bad_creds"))).toBeTruthy();
    expect((screen.getByLabelText("Parol") as HTMLInputElement).value).toBe("");
    expect(postsTo("/api/analyst/login")).toEqual([]);
  });

  it("sends another tier's account to its own cabinet", async () => {
    setLoginResult({ role: "company", target: "company.html" });
    stubApi(ROUTES);
    renderPage(<TahlilPage />);
    await screen.findByRole("heading", { name: uz("an_title") });

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("company.html"));
  });

  it("signs out on the server and shows the login form", async () => {
    await renderCabinet();

    fireEvent.click(screen.getByRole("button", { name: uz("an_logout") }));

    expect(await screen.findByRole("heading", { name: uz("an_title") })).toBeTruthy();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("never puts a login or a password in a request body or address", async () => {
    vi.spyOn(dialogs, "toast").mockImplementation(() => undefined);
    await renderCabinet({ "/api/analyst/export": 500 });
    await screen.findByText(uz("an_k_companies"));

    openView("an_nav_segments");
    await screen.findByText("Agro");
    openView("an_nav_trends");
    await waitFor(() => expect(postsTo("/api/analyst/series")).toHaveLength(1));
    openView("an_nav_reports");
    fireEvent.click(screen.getByRole("button", { name: uz("an_dl_doc") }));
    await waitFor(() => expect(postsTo("/api/analyst/export")).toHaveLength(1));

    const calls = (fetch as unknown as FetchStub).mock.calls as [string, { body?: string }?][];
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const [url, options] of calls) {
      expect(url).not.toMatch(/login=|password=/i);
      const body = JSON.parse(options?.body ?? "{}") as Record<string, unknown>;
      expect(body).not.toHaveProperty("login");
      expect(body).not.toHaveProperty("password");
    }
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("kg_an")).toBeNull();
  });
});

describe("TahlilPage views", () => {
  it("shows the overview figures and funnels, with hostile labels as text", async () => {
    const { container } = await renderCabinet();

    expect(await screen.findByText(`+7 ${uz("an_k_new")}`)).toBeTruthy();
    expect(container.querySelectorAll(".an-kpi")).toHaveLength(6);
    expect(container.querySelectorAll(".an-box .an-bar")).toHaveLength(16);
    expect(screen.getByText(HOSTILE)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(postsTo("/api/analyst/overview")[0]).toEqual({ days: 90 });
  });

  it("asks again for the chosen period", async () => {
    await renderCabinet();
    await screen.findByText(uz("an_k_companies"));

    fireEvent.click(screen.getByRole("button", { name: `30${uz("an_days")}` }));

    await waitFor(() => expect(postsTo("/api/analyst/overview").at(-1)).toEqual({ days: 30 }));
  });

  it("says so when the data cannot be loaded", async () => {
    await renderCabinet({ "/api/analyst/overview": 500 });

    expect(await screen.findByText(uz("an_fail"))).toBeTruthy();
  });

  it("lists a segment for the analyst's own markets only", async () => {
    const { container } = await renderCabinet();

    openView("an_nav_segments");

    expect(await screen.findByText("Agro")).toBeTruthy();
    expect(postsTo("/api/analyst/segment")[0]).toEqual({ days: 90, module: "bozor", dimension: "" });
    expect([...container.querySelectorAll("#segModule button")].map(button => button.textContent)).toEqual([
      uz("an_mod_bozor"),
      uz("an_mod_mehnat"),
    ]);
    expect(screen.getByText(HOSTILE)).toBeTruthy();
    expect(screen.getByText(uz("an_suppressed"))).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: uz("an_d_region") }));

    await waitFor(() => expect(postsTo("/api/analyst/segment").at(-1)).toMatchObject({ dimension: "region" }));
  });

  it("draws the trend with one column per non-empty bucket", async () => {
    const { container } = await renderCabinet();

    openView("an_nav_trends");

    await waitFor(() => expect(container.querySelectorAll(".an-chart rect")).toHaveLength(2));
    expect(container.querySelector(".an-trend")?.className).toContain("is-down");
    expect(postsTo("/api/analyst/series")[0]).toMatchObject({ module: "bozor", metric: "", bucket: "week" });

    fireEvent.click(screen.getByRole("button", { name: uz("an_b_month") }));

    await waitFor(() => expect(postsTo("/api/analyst/series").at(-1)).toMatchObject({ bucket: "month" }));
  });

  it("reports a failed export instead of downloading nothing", async () => {
    const toast = vi.spyOn(dialogs, "toast").mockImplementation(() => undefined);
    await renderCabinet({ "/api/analyst/export": 500 });

    openView("an_nav_reports");
    fireEvent.click(screen.getByRole("button", { name: uz("an_dl_xlsx") }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(uz("an_fail"), { tone: "error" }));
    expect(postsTo("/api/analyst/export")[0]).toEqual({ days: 90, kind: "xlsx" });
  });
});
