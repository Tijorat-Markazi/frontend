import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused, signInAs, stubCabinetApi } from "../../shell/cabinet/testApi";
import { navigate } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { renderPage } from "../../test/renderPage";
import { CompanyPage } from "./CompanyPage";
import { BASE, COMPANY_SESSION, openCabinet, openView, submitLogin } from "./testFixtures";
import { OT } from "./text";

const storedText = (): string => JSON.stringify([{ ...sessionStorage }, { ...localStorage }]);

describe("CompanyPage sign-in", () => {
  it("opens the cabinet for a session that already holds the company role", async () => {
    const { calls, container } = await openCabinet();

    expect(screen.getByRole("heading", { level: 2, name: "Alfa MChJ" })).toBeTruthy();
    expect(bodiesSentTo(calls, "/api/company/login")).toEqual([{}]);
    expect(auth.login).not.toHaveBeenCalled();
    expect(container.querySelector("#coAssoc")?.textContent).toBe("Paxta uyushmasi");
    expect(container.querySelector("#aiNav")?.getAttribute("href")).toBe("assistant.html");
  });

  it("shows the form to a guest, another role and a restricted session", async () => {
    const calls = stubCabinetApi(BASE);

    const guest = renderPage(<CompanyPage />);
    expect(await screen.findByRole("heading", { name: OT.lg_title[0] })).toBeTruthy();
    guest.unmount();

    signInAs("buyer", { id: "b1" });
    const other = renderPage(<CompanyPage />);
    expect(await screen.findByRole("heading", { name: OT.lg_title[0] })).toBeTruthy();
    other.unmount();

    setTestSession({ authenticated: true, role: "company", restricted: true, user: { id: "c1" } });
    renderPage(<CompanyPage />);
    expect(await screen.findByRole("heading", { name: OT.lg_title[0] })).toBeTruthy();

    expect(calls).toEqual([]);
  });

  it("signs in through the shared resolver, then asks for the company with an empty body", async () => {
    setLoginResult(COMPANY_SESSION);
    const calls = stubCabinetApi(BASE);
    const { container } = renderPage(<CompanyPage />);
    await screen.findByRole("heading", { name: OT.lg_title[0] });

    submitLogin(container, " alfa ", "secret");

    expect(await screen.findByRole("heading", { level: 2, name: "Alfa MChJ" })).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("alfa", "secret");
    expect(bodiesSentTo(calls, "/api/company/login")).toEqual([{}]);
    expect(storedText()).not.toMatch(/alfa|secret/);
  });

  it("says the pair is wrong when no tier accepts it", async () => {
    setLoginResult(null);
    const calls = stubCabinetApi(BASE);
    const { container } = renderPage(<CompanyPage />);
    await screen.findByRole("heading", { name: OT.lg_title[0] });

    submitLogin(container, "alfa", "nope");

    expect(await screen.findByText(OT.err[0])).toBeTruthy();
    expect(calls).toEqual([]);
    expect(container.querySelector<HTMLInputElement>("#coPassInp")?.value).toBe("");
  });

  it("says the pair is wrong when the session opens but the company is refused", async () => {
    setLoginResult(COMPANY_SESSION);
    stubCabinetApi({ ...BASE, "/api/company/login": refused(403) });
    const { container } = renderPage(<CompanyPage />);
    await screen.findByRole("heading", { name: OT.lg_title[0] });

    submitLogin(container, "alfa", "secret");

    expect(await screen.findByText(OT.err[0])).toBeTruthy();
  });

  it("sends an association account to its own cabinet", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult({ role: "assoc", target: "association.html", user: { id: "a1", role: "assoc" } });
    const calls = stubCabinetApi(BASE);
    const { container } = renderPage(<CompanyPage />);
    await screen.findByRole("heading", { name: OT.lg_title[0] });

    submitLogin(container, "chair", "pass");

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("association.html"));
    expect(calls).toEqual([]);
  });

  it("signs out through the session and shows the login form without leaving the page", async () => {
    await openCabinet();

    fireEvent.click(screen.getByRole("button", { name: OT.logout[0] }));

    expect(await screen.findByRole("heading", { name: OT.lg_title[0] })).toBeTruthy();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("carries no login or password in any request, address or store", async () => {
    setLoginResult(COMPANY_SESSION);
    const calls = stubCabinetApi({
      ...BASE,
      "/api/company/showroom": body => ({ ok: true, showroom: body.items }),
      "/api/company/items": { items: [] },
      "/api/company/news": { items: [] },
      "/api/company/appeal": { agencies: ["DBQ"], items: [{ id: "ap1", subject: "Bojxona", stage: "new", history: [] }] },
      "/api/business-id/contact": { ok: true, bizId: "TM-9", contact: {} },
      "/api/legal/export": { ok: true, data: {} },
    });
    const { container } = renderPage(<CompanyPage />);
    await screen.findByRole("heading", { name: OT.lg_title[0] });
    submitLogin(container, "alfa", "secret");
    await screen.findByRole("heading", { level: 1, name: OT.nav_dash[0] });

    for (const label of [OT.nav_show[0], OT.nav_invest[0], OT.nav_news[0], OT.nav_bizid[0], OT.nav_legal[0]]) {
      openView(label);
      await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: label })).toBeTruthy());
    }
    openView(OT.nav_gov[0]);
    await screen.findByText("Bojxona");

    expect(calls.length).toBeGreaterThan(6);
    /* The only address that may say "login" is the company's own account call. */
    expect(JSON.stringify(calls.map(call => call.body))).not.toMatch(/login|password|alfa|secret/);
    expect(calls.map(call => call.url.replace("/api/company/login", "")).join(" ")).not.toMatch(/login|password|alfa|secret/);
    expect(container.innerHTML).not.toMatch(/password=|login=|secret/);
    expect(storedText()).not.toMatch(/alfa|secret/);
  });
});
