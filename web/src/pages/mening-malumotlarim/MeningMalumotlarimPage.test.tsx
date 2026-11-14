import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { T_DSR } from "@legacy/dsr-i18n.js";
import { PANEL_TEXT } from "../../shell/legal/panelText";
import { goTo } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { HOSTILE, renderPage, stubApi } from "../../test/renderPage";
import { MeningMalumotlarimPage } from "./MeningMalumotlarimPage";

vi.mock("../../shell/navigate", () => ({ goTo: vi.fn(), replaceWith: vi.fn() }));

const text = (key: string): string => T_DSR[key]![0];

const EXPORT = {
  ok: true,
  data: { rightsRequests: [{ ref: HOSTILE, kind: HOSTILE, status: "open", due: 0 }] },
};
const RIGHTS_SESSION = {
  role: "company",
  restricted: true,
  target: "mening-malumotlarim.html",
  user: { id: "c1", role: "company", login: "alfa" },
};

type FetchStub = ReturnType<typeof vi.fn>;
type FetchCall = [url: string, options?: RequestInit];

const fetchCalls = (): FetchCall[] => (fetch as unknown as FetchStub).mock.calls as FetchCall[];

const bodiesPostedTo = (path: string): unknown[] =>
  fetchCalls()
    .filter(([url]) => url === path)
    .map(([, options]) => JSON.parse(String(options?.body)));

const panelHeading = () => screen.findByRole("heading", { name: PANEL_TEXT.h[0] });

async function signIn(login: string, password: string): Promise<void> {
  fireEvent.change(await screen.findByLabelText(text("dsr_lg")), { target: { value: login } });
  fireEvent.change(screen.getByLabelText(text("dsr_pw")), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: text("dsr_login_btn") }));
}

describe("MeningMalumotlarimPage", () => {
  it("opens a restricted rights session for a guest, then shows the rights panel", async () => {
    stubApi({ "/api/legal/export": EXPORT });
    setLoginResult(RIGHTS_SESSION);
    renderPage(<MeningMalumotlarimPage />);
    expect(await screen.findByText(text("dsr_login_why"))).toBeTruthy();

    await signIn(" alfa ", "secret-pass");

    expect(await panelHeading()).toBeTruthy();
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith("alfa", "secret-pass", "rights");
    expect(screen.getByRole("heading", { name: PANEL_TEXT.fix_h[0] })).toBeTruthy();
    expect(screen.queryByText(text("dsr_login_h"))).toBeNull();
  });

  it("keeps the login and the password out of storage and out of every request", async () => {
    stubApi({ "/api/legal/export": EXPORT, "/api/legal/erase": { ok: true, ref: "DS-1", due: 0 } });
    setLoginResult(RIGHTS_SESSION);
    const { container } = renderPage(<MeningMalumotlarimPage />);

    await signIn("alfa", "secret-pass");
    await panelHeading();
    fireEvent.click(container.querySelector("#lgsErase")!);
    await waitFor(() => expect(bodiesPostedTo("/api/legal/erase")).toHaveLength(1));

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("kg_co")).toBeNull();
    expect(bodiesPostedTo("/api/legal/export")[0]).toEqual({});
    const sent = fetchCalls().map(([url, options]) => `${url} ${String(options?.body ?? "")}`);
    expect(sent.length).toBeGreaterThan(1);
    sent.forEach(request => expect(request).not.toMatch(/login|password|alfa|secret-pass/));
  });

  it("refuses a pair the server will not sign in and asks nothing of the rights endpoints", async () => {
    stubApi({ "/api/legal/export": EXPORT });
    setLoginResult(null);
    const { container } = renderPage(<MeningMalumotlarimPage />);

    await signIn("alfa", "wrong");

    expect(await screen.findByText(text("dsr_login_bad"))).toBeTruthy();
    expect(screen.queryByRole("heading", { name: PANEL_TEXT.h[0] })).toBeNull();
    expect(bodiesPostedTo("/api/legal/export")).toHaveLength(0);
    /* Production redraws the form, so the refused password does not linger. */
    expect(container.querySelector<HTMLInputElement>("#dsrPw")!.value).toBe("");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: text("dsr_login_btn") }).disabled).toBe(false);
  });

  it("shows the sign-in form when the session service cannot be reached", async () => {
    stubApi({});
    vi.mocked(auth.ready).mockRejectedValueOnce(new Error("Session service unavailable"));

    renderPage(<MeningMalumotlarimPage />);

    expect(await screen.findByText(text("dsr_login_h"))).toBeTruthy();
  });

  it.each([
    ["a full buyer session", { role: "buyer", user: { id: "b1" } }],
    ["a restricted rights session", RIGHTS_SESSION],
  ])("uses %s that is already open, without asking again", async (_name, session) => {
    stubApi({ "/api/legal/export": EXPORT });
    setTestSession({ authenticated: true, ...session });

    renderPage(<MeningMalumotlarimPage />);

    expect(await panelHeading()).toBeTruthy();
    expect(bodiesPostedTo("/api/legal/export")).toEqual([{}]);
    expect(screen.queryByText(text("dsr_login_h"))).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("says the data could not be loaded for a signed-in role the rights do not cover", async () => {
    stubApi({ "/api/legal/export": { error: "forbidden" } });
    setTestSession({ authenticated: true, role: "admin", user: { id: "adm" } });

    renderPage(<MeningMalumotlarimPage />);

    expect(await screen.findByText(PANEL_TEXT.failed[0])).toBeTruthy();
    expect(screen.queryByText(text("dsr_login_h"))).toBeNull();
  });

  it("goes back to the sign-in form when the session ends", async () => {
    stubApi({ "/api/legal/export": EXPORT });
    setTestSession({ authenticated: true, ...RIGHTS_SESSION });
    renderPage(<MeningMalumotlarimPage />);
    await panelHeading();

    await auth.logout();

    expect(await screen.findByText(text("dsr_login_h"))).toBeTruthy();
    expect(screen.queryByRole("heading", { name: PANEL_TEXT.h[0] })).toBeNull();
  });

  it("renders hostile request rows as text", async () => {
    stubApi({ "/api/legal/export": EXPORT });
    setLoginResult(RIGHTS_SESSION);
    const { container } = renderPage(<MeningMalumotlarimPage />);

    await signIn("alfa", "secret-pass");

    await panelHeading();
    expect(screen.getAllByText(HOSTILE)).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();
  });

  it("ends the server session and goes home after consent is withdrawn", async () => {
    stubApi({ "/api/legal/export": EXPORT, "/api/legal/withdraw": { ok: true } });
    setTestSession({ authenticated: true, role: "company", user: { id: "c1" } });
    const { container } = renderPage(<MeningMalumotlarimPage />);
    await panelHeading();

    fireEvent.change(container.querySelector("#lgsWord")!, { target: { value: PANEL_TEXT.wd_word[0] } });
    fireEvent.click(screen.getByRole("button", { name: PANEL_TEXT.wd_btn[0] }));

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("index.html"), { timeout: 3000 });
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(bodiesPostedTo("/api/legal/withdraw")).toEqual([{}]);
  });
});
