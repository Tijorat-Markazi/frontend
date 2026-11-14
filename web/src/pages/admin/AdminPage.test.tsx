import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { signInAs } from "../../shell/cabinet/testApi";
import { dialogs } from "../../shell/dialogs";
import { goTo } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { renderPage } from "../../test/renderPage";
import { AdminPage } from "./AdminPage";
import { NAV, VIEW_TITLE } from "./navItems";
import { button, credentialCarriers, orgsFixture, stubRoutes, type, uz } from "./testKit";
import { AT } from "./text";

vi.mock("../../shell/navigate", () => ({ goTo: vi.fn(), replaceWith: vi.fn() }));

const PASSWORD = "s3cret-Pa55";
const RAIS_VIEWS = ["dashboard", "projects", "chat", "questions", "appeals", "buyers"];
const RAIS_SIDEBAR = NAV.filter(item => RAIS_VIEWS.includes(item.view));

async function signIn(login: string, password: string): Promise<void> {
  type(await screen.findByLabelText("Login"), login);
  type(screen.getByLabelText(uz("as_pass")), password);
  fireEvent.click(button(uz("lg_btn")));
}

const heading = (): string => screen.getByRole("heading", { level: 1 }).textContent ?? "";
const panelOpens = async (): Promise<HTMLElement> => screen.findByRole("heading", { level: 1 });
const cardShows = async (): Promise<HTMLElement> => screen.findByRole("heading", { name: uz("lg_title") });
const sidebar = (): string[] => [...document.querySelectorAll("#adminNav button")].map(item => item.textContent ?? "");

describe("AdminPage sign-in", () => {
  it("opens the panel on the dashboard when the pair belongs to the admin, keeping it nowhere", async () => {
    const api = stubRoutes({ "/api/orgs": orgsFixture() });
    setLoginResult({ role: "admin", target: "admin.html" });
    renderPage(<AdminPage />);

    await signIn("  boss ", PASSWORD);

    await waitFor(() => expect(heading()).toBe(uz("nav_dash")));
    expect(auth.login).toHaveBeenCalledWith("boss", PASSWORD);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify({ ...localStorage })).not.toContain(PASSWORD);
    expect(document.body.innerHTML).not.toContain(PASSWORD);
    expect(credentialCarriers(api)).toEqual([]);
  });

  it("opens the shorter panel when the pair belongs to the rais", async () => {
    stubRoutes({ "/api/orgs": orgsFixture() });
    setLoginResult({ role: "rais", target: "admin.html" });
    renderPage(<AdminPage />);

    await signIn("rais", PASSWORD);

    await panelOpens();
    expect(sidebar()).toEqual(RAIS_SIDEBAR.map(item => uz(item.textKey)));
  });

  it("reports a refused pair, empties the password box and stays on the sign-in card", async () => {
    const api = stubRoutes({});
    renderPage(<AdminPage />);

    await signIn("boss", "wrong");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(uz("lg_err")));
    expect((screen.getByLabelText(uz("as_pass")) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("treats a dropped connection as a failed sign-in", async () => {
    stubRoutes({});
    vi.mocked(auth.login).mockRejectedValueOnce(new Error("offline"));
    renderPage(<AdminPage />);

    await signIn("boss", PASSWORD);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(uz("lg_err")));
  });

  it("sends the pair of another tier to the cabinet of that tier", async () => {
    stubRoutes({});
    setLoginResult({ role: "company", target: "company.html" });
    renderPage(<AdminPage />);

    await signIn("alfa", PASSWORD);

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("company.html"));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows the production hint and never a demo password", async () => {
    stubRoutes({});
    renderPage(<AdminPage />);

    expect((await screen.findByText(uz("lg_hint"))).id).toBe("lgHint");
    expect(document.body.textContent).not.toMatch(/parol:\s*admin/i);
  });
});

describe("AdminPage session", () => {
  it("shows the sign-in card to a guest and asks the server for nothing", async () => {
    const api = stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);

    await cardShows();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("shows the sign-in card to a session of another role", async () => {
    signInAs("company");
    const api = stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);

    await cardShows();
    expect(api.calls).toEqual([]);
  });

  it("shows the sign-in card to an admin session restricted to the personal-data page", async () => {
    setTestSession({ authenticated: true, role: "admin", restricted: true });
    stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);

    await cardShows();
  });

  it("ignores the old browser flag: only the server session opens the panel", async () => {
    sessionStorage.setItem("kg_admin", "1");
    stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);

    await cardShows();
  });

  it("opens straight into the panel for an admin session and signs out to the card", async () => {
    signInAs("admin");
    stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);
    await panelOpens();
    expect(heading()).toBe(uz("nav_dash"));
    expect(sidebar()).toEqual(NAV.map(item => uz(item.textKey)));

    fireEvent.click(button(uz("logout")));

    await cardShows();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("keeps the panel open and says why when signing out cannot reach the server", async () => {
    signInAs("admin");
    stubRoutes({ "/api/orgs": orgsFixture() });
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    vi.mocked(auth.logout).mockRejectedValueOnce(new Error("offline"));
    renderPage(<AdminPage />);
    await panelOpens();

    fireEvent.click(button(uz("logout")));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("offline"));
    expect(heading()).toBe(uz("nav_dash"));
  });

  it("offers a rais only the six views production gives that role", async () => {
    signInAs("rais");
    stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);
    await panelOpens();

    expect(sidebar()).toEqual(RAIS_SIDEBAR.map(item => uz(item.textKey)));
    expect(screen.queryByRole("button", { name: uz("nav_set") })).toBeNull();
    for (const item of RAIS_SIDEBAR) {
      fireEvent.click(button(uz(item.textKey)));
      expect(heading()).toBe(uz(VIEW_TITLE[item.view]));
    }
  });

  it("seeds the two demo lists the first time the panel is opened", async () => {
    stubRoutes({});
    renderPage(<AdminPage />);
    await cardShows();

    expect(JSON.parse(localStorage.getItem("kg_companies") ?? "[]")).toHaveLength(4);
    expect(JSON.parse(localStorage.getItem("kg_leads") ?? "[]")).toHaveLength(3);
  });

  it("shows the real counts of the registry on the dashboard and names no caller in the request", async () => {
    signInAs("admin");
    const api = stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);

    expect(await screen.findByText("1 / 2")).toBeTruthy();
    expect(api.bodies("/api/orgs")[0]).toEqual({ op: "list" });
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(uz("flow"));
  });

  it("opens every sidebar entry under its own heading without a login or password in any request", async () => {
    signInAs("admin", { login: "boss" });
    const api = stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);
    await panelOpens();

    for (const item of NAV) {
      fireEvent.click(button(uz(item.textKey)));
      expect(heading()).toBe(uz(VIEW_TITLE[item.view]));
    }
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: uz("nav_set") })).toBeTruthy());
    expect(api.calls.length).toBeGreaterThan(NAV.length / 2);
    expect(credentialCarriers(api)).toEqual([]);
  });

  it("switches the whole panel to the next language and remembers it", async () => {
    signInAs("admin");
    stubRoutes({ "/api/orgs": orgsFixture() });
    renderPage(<AdminPage />);
    await panelOpens();

    fireEvent.click(button("UZ"));

    expect(heading()).toBe(AT.nav_dash[1]);
    expect(button(AT.logout[1])).toBeTruthy();
    expect(localStorage.getItem("kg_lang")).toBe("ru");
  });

  it("toggles the theme from the top bar and from the settings view alike", async () => {
    signInAs("admin");
    stubRoutes({});
    renderPage(<AdminPage />);
    await panelOpens();

    fireEvent.click(screen.getByTitle("Tema"));
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(button(uz("nav_set")));
    fireEvent.click(button(uz("light")));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(localStorage.getItem("kg_theme")).toBe("light");

    fireEvent.click(button("EN"));
    await waitFor(() => expect(heading()).toBe(AT.nav_set[2]));
  });
});
