import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused, signInAs } from "../../shell/cabinet/testApi";
import { navigate } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { HOSTILE, setSearch } from "../../test/renderPage";
import { mergeFiles, splitFiles } from "./replyFiles";
import { limitView } from "./useAssistantChat";
import { PING, USAGE, CHAT, SESSIONS, UNLIMITED, LOGIN_ERROR, flush, renderAssistant, fill, signIn, enterDemo, askQuestion, isHidden, list, requested, statusOf, everythingSent } from "./testKit";

afterEach(() => setSearch(""));

describe("AssistantPage sign-in", () => {
  it("asks a guest for a login once the server has answered, and shows no chat", async () => {
    const { container } = await renderAssistant();

    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
    expect(screen.getByRole("heading", { name: "Tizimga kiriş" })).toBeTruthy();
    /* With the chat hidden, a footer would sit under the header behind the card. */
    expect(container.querySelector("footer.footer")).toBeNull();
  });

  it("signs in through the session and opens the cabinet the server names", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult({ role: "company", target: "company.html", user: { id: "c1", login: "acme" } });
    const { container, calls } = await renderAssistant();

    await signIn(container, "  acme ", "pw");

    expect(auth.login).toHaveBeenCalledWith("acme", "pw");
    expect(goTo).toHaveBeenCalledWith("company.html");
    /* The pair went to auth.login and nowhere else. */
    expect(container.querySelector<HTMLInputElement>("#passInput")?.value).toBe("");
    expect(everythingSent(calls)).not.toMatch(/pw|password|"login"/);
  });

  it("says the login is wrong when the server refuses, and lets the visitor retry", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult(null);
    const { container } = await renderAssistant();

    await signIn(container, "acme", "wrong");

    expect(container.querySelector("#emailErr")?.textContent).toBe(LOGIN_ERROR);
    expect(container.querySelector<HTMLButtonElement>('#emailForm button[type="submit"]')?.disabled).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
    expect(goTo).not.toHaveBeenCalled();
  });

  it("never follows a target that is not a page of this site", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult({ role: "company", target: "https://evil.example/x.html" });
    const { container } = await renderAssistant();

    await signIn(container, "acme", "pw");

    expect(goTo).not.toHaveBeenCalled();
    expect(container.querySelector("#emailErr")?.textContent).toBe(LOGIN_ERROR);
  });

  it("asks for both fields without calling the server", async () => {
    const { container } = await renderAssistant();

    fireEvent.submit(container.querySelector("#emailForm")!);
    await flush();

    expect(container.querySelector("#emailErr")?.textContent).toBe(LOGIN_ERROR);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("goes back to the home page from the close button", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    const { container } = await renderAssistant();

    fireEvent.click(container.querySelector("#loginClose")!);

    expect(goTo).toHaveBeenCalledWith("index.html");
  });

  it("refuses demo access without a gmail address", async () => {
    const { container } = await renderAssistant();

    fill(container, "#demoEmailInput", "ali@mail.ru");
    fireEvent.click(container.querySelector("#demoBtn")!);
    await flush();

    expect(container.querySelector("#demoErr")?.textContent).toBe("Email notöğri");
    expect(auth.guest).not.toHaveBeenCalled();
    expect(isHidden(container, "#asstApp")).toBe(true);
  });

  it("stays on the sign-in card with the reason when the demo is refused by the server", async () => {
    vi.mocked(auth.guest).mockRejectedValueOnce(new Error("email_invalid"));
    const { container } = await enterDemo();

    expect(container.querySelector("#demoErr")?.textContent).toBe("email_invalid");
    expect(isHidden(container, "#asstApp")).toBe(true);
  });

  it("takes no identity from the address or from browser storage", async () => {
    sessionStorage.setItem("kg_admin", "1");
    sessionStorage.setItem("kg_co", JSON.stringify({ login: "acme", password: "pw" }));
    localStorage.setItem("kg_email", "boss@example.com");
    setSearch("?panel=admin&co=Acme%20LLC");
    const { container, calls } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list([]) });

    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
    expect(requested(calls)).toEqual([PING]);
  });

  it("treats a session restricted to the personal-data page as signed out", async () => {
    setTestSession({ authenticated: true, restricted: true, role: "company", user: { id: "c1", login: "acme" } });
    const { container, calls } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list([]) });

    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
    expect(requested(calls)).toEqual([PING]);
  });

  it("stops at the sign-in card with the reason when the server cannot be reached", async () => {
    signInAs("company", { login: "acme" });
    const { container } = await renderAssistant({ [PING]: refused(503, { error: "unavailable" }) });

    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
    expect(container.querySelector("#emailErr")?.textContent).toBe("unavailable");
  });
});

describe("AssistantPage for a signed-in account", () => {
  const SESSION = "/api/session?id=s%201";

  it("skips the sign-in, reopens the latest chat and links back to the cabinet", async () => {
    signInAs("company", { login: "acme", name: "Acme LLC" });
    const sessions = [{ id: "s 1", title: HOSTILE, updated: 1700000000000 }];
    const messages = [
      { role: "user", text: "Eski savol" },
      { role: "assistant", text: "Eski javob /uploads/a.pdf" },
    ];
    const { container, calls } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list(sessions), [SESSION]: { messages } });

    expect(isHidden(container, "#asstLogin")).toBe(true);
    /* A panel, like the cabinets: the site footer is for public pages. */
    expect(container.querySelector("footer.footer")).toBeNull();
    expect(container.querySelector("#uEmail")?.textContent).toBe("Acme LLC");
    expect(isHidden(container, "#switchEmail")).toBe(true);
    expect(isHidden(container, "#limitNote")).toBe(true);
    expect(container.querySelector(".session-item.active b")?.textContent).toBe(HOSTILE);
    expect(container.querySelector(".session-item img")).toBeNull();
    expect(screen.getByText("Eski savol")).toBeTruthy();
    expect(container.querySelector(".msg-file")?.getAttribute("href")).toBe("/uploads/a.pdf");
    expect(screen.getByRole("link", { name: "← Panelga qaytiş" }).getAttribute("href")).toBe("company.html");
    /* The history is asked for by the cookie alone. */
    expect(requested(calls)).toEqual([PING, USAGE, SESSIONS, SESSION]);
  });

  it.each(["admin", "rais", "assoc", "analyst", "buyer"])("serves a signed-in %s as well", async role => {
    signInAs(role, { login: "kim" });
    const { container } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list([]) });

    expect(isHidden(container, "#asstApp")).toBe(false);
    expect(container.querySelector("#uEmail")?.textContent).toBe("kim");
  });

  it("files a question under the session: no account, company or credential travels with it", async () => {
    signInAs("company", { login: "acme", name: "Acme LLC" });
    setSearch("?co=Other%20LLC&panel=admin");
    const { container, calls } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list([]), [CHAT]: { reply: "Javob" } });

    await askQuestion(container, "Savol");

    const [body] = bodiesSentTo(calls, CHAT);
    expect(Object.keys(body).sort()).toEqual(["attachment", "id", "lang", "message"]);
    expect(body).toMatchObject({ message: "Savol", lang: "uz", attachment: null });
    expect(String(body.id)).toMatch(/^sess_\d+$/);
    expect(container.querySelector("#uEmail")?.textContent).toBe("Acme LLC");
    expect(screen.getByText("Javob")).toBeTruthy();
    expect(bodiesSentTo(calls, USAGE)).toEqual([{}]);
    expect(everythingSent(calls)).not.toMatch(/login|password|pass"|email|guestId|auth"|company|acme|Other/i);
  });

  it("says why the chat list could not be read", async () => {
    signInAs("company", { login: "acme" });
    const { container } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: refused(401, { error: "login_required" }) });

    expect(statusOf(container)).toBe("login_required");
    expect(container.querySelector(".session-empty")).toBeTruthy();
  });

  it("follows the session when it ends", async () => {
    signInAs("company", { login: "acme" });
    const { container } = await renderAssistant({ [USAGE]: UNLIMITED, [SESSIONS]: list([]) });
    expect(isHidden(container, "#asstApp")).toBe(false);

    act(() => setTestSession({}));

    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
  });
});

describe("assistant reply helpers", () => {
  it("lifts linked files out of the sentence", () => {
    const result = splitFiles("Hujjat tayyor:\n[Biznes reja](/uploads/plan-1.pdf)\n\n\n\nYana: /uploads/t.xlsx");

    expect(result.text).toBe("Hujjat tayyor\n\nYana");
    expect(result.files).toEqual([
      { url: "/uploads/plan-1.pdf", name: "Biznes reja" },
      { url: "/uploads/t.xlsx", name: "t.xlsx" },
    ]);
  });

  it("leaves a link that is not one of our uploads in the text", () => {
    expect(splitFiles("[x](https://evil.example/a.pdf)").files).toEqual([]);
  });

  it("lists each document once, preferring what the server reported", () => {
    const merged = mergeFiles([{ url: "/uploads/a.pdf", name: "A", size: 10 }], [{ url: "/uploads/a.pdf", name: "a.pdf" }]);

    expect(merged).toEqual([{ url: "/uploads/a.pdf", name: "A", size: 10 }]);
  });

  it("works out the free questions left", () => {
    expect(limitView(null).isShown).toBe(false);
    expect(limitView({ isPrivileged: true, max: 3, remaining: 0, used: 3, isLimit: false }).isShown).toBe(false);
    expect(limitView({ isPrivileged: false, max: 3, remaining: null, used: 1, isLimit: false })).toMatchObject({ remaining: 2, isOver: false });
    expect(limitView({ isPrivileged: false, max: 3, remaining: 2, used: 1, isLimit: true }).isOver).toBe(true);
  });
});
