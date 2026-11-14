import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused, signInAs, stubCabinetApi } from "../../shell/cabinet/testApi";
import { dialogs } from "../../shell/dialogs";
import { navigate } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult } from "../../test/fakeSession";
import { renderPage } from "../../test/renderPage";
import { AssociationPage } from "./AssociationPage";
import { BASE, openCabinet, openView, signIn, submitLogin } from "./testCabinet";
import { AT } from "./text";

describe("AssociationPage sign-in", () => {
  it("opens the cabinet for a session that already holds the association role", async () => {
    const { calls, container } = await openCabinet();

    expect(auth.login).not.toHaveBeenCalled();
    expect(bodiesSentTo(calls, "/api/assoc/login")).toEqual([{}]);
    expect(container.querySelector("#asBrandSub")?.textContent).toBe("Paxta uyushmasi");
    await waitFor(() => expect(document.title).toBe("Paxta uyushmasi — TIJORAT MARKAZI"));
  });

  it("shows the form to a guest and to another role, without asking for the account", async () => {
    const calls = stubCabinetApi(BASE);
    const guest = renderPage(<AssociationPage />);
    expect(await screen.findByRole("heading", { name: AT.lg_title[0] })).toBeTruthy();
    guest.unmount();

    signInAs("company", { id: "c1" });
    renderPage(<AssociationPage />);

    expect(await screen.findByRole("heading", { name: AT.lg_title[0] })).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("shows the form when the server no longer knows the association behind the session", async () => {
    signIn();
    stubCabinetApi({ ...BASE, "/api/assoc/login": refused(401, { error: "invalid credentials" }) });

    renderPage(<AssociationPage />);

    expect(await screen.findByRole("heading", { name: AT.lg_title[0] })).toBeTruthy();
  });

  it("signs in through the session and opens the cabinet", async () => {
    setLoginResult({ role: "assoc", target: "association.html", user: { id: "a1" } });
    const calls = stubCabinetApi(BASE);
    const { container } = renderPage(<AssociationPage />);
    await screen.findByRole("heading", { name: AT.lg_title[0] });

    submitLogin(container, " chair ", "secret");

    expect(await screen.findByRole("heading", { level: 1, name: AT.nav_dash[0] })).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("chair", "secret");
    expect(bodiesSentTo(calls, "/api/assoc/login")).toEqual([{}]);
    expect(sessionStorage.length).toBe(0);
  });

  it("says the pair is wrong when no tier accepts it", async () => {
    setLoginResult(null);
    stubCabinetApi(BASE);
    const { container } = renderPage(<AssociationPage />);
    await screen.findByRole("heading", { name: AT.lg_title[0] });

    submitLogin(container, "chair", "nope");

    expect(await screen.findByText(AT.err[0])).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#asPassInp")?.value).toBe("");
  });

  it("sends a company account to the company cabinet", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult({ role: "company", target: "company.html" });
    stubCabinetApi(BASE);
    const { container } = renderPage(<AssociationPage />);
    await screen.findByRole("heading", { name: AT.lg_title[0] });

    submitLogin(container, "alfa", "pw");

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("company.html"));
  });

  it("ends the server session and leaves for the directory", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    await openCabinet();

    fireEvent.click(screen.getByRole("button", { name: AT.logout[0] }));

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("associations.html"));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("stays in the cabinet and says why when signing out fails", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    await openCabinet();
    vi.mocked(auth.logout).mockRejectedValueOnce(new Error("offline"));

    fireEvent.click(screen.getByRole("button", { name: AT.logout[0] }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("offline"));
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: AT.nav_dash[0] })).toBeTruthy();
  });

  it("never puts a login or a password in a request body or address", async () => {
    vi.spyOn(dialogs, "toast").mockImplementation(() => undefined);
    const appeal = { id: "ap1", subject: "Bojxona", stage: "new", companyName: "Alfa", agency: "DBQ", body: "Matn", history: [] };
    const { calls } = await openCabinet({
      "/api/assoc/news": { items: [] },
      "/api/assoc/questions": { ym: "2026-03", months: ["2026-03"], users: [], report: [] },
      "/api/assoc/report": { ym: "2026-03", companyCount: 0, questions: 0, companies: [] },
      "/api/assoc/appeals": { items: [appeal] },
      "/api/assoc/conference": { meetings: [] },
    });

    for (const label of [AT.nav_regs[0], AT.nav_quest[0], AT.nav_news[0], AT.nav_conf[0], AT.nav_report[0]]) openView(label);
    await waitFor(() => expect(bodiesSentTo(calls, "/api/assoc/report")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(AT.rep_download[0]) }));
    openView(AT.nav_appeals[0]);
    fireEvent.click(await screen.findByRole("button", { name: AT.ap_doc[0] }));

    await waitFor(() => expect(calls.some(call => call.url.startsWith("/api/appeal/doc"))).toBe(true));
    expect(calls.some(call => call.url.startsWith("/api/assoc/report.doc"))).toBe(true);
    for (const call of calls) {
      expect(call.url).not.toMatch(/login=|password=/i);
      expect(call.body).not.toHaveProperty("login");
      expect(call.body).not.toHaveProperty("password");
    }
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("kg_as")).toBeNull();
  });
});
