import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceWith } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { renderPage, setSearch, stubApi } from "../../test/renderPage";
import { KirishPage } from "./KirishPage";
import { TEXT } from "./text";

vi.mock("../../shell/navigate", () => ({ goTo: vi.fn(), replaceWith: vi.fn() }));

type FetchStub = ReturnType<typeof vi.fn>;

const COMPANY = { role: "company", target: "company.html", user: { id: "c1", name: "Alfa" } };
const UNSAFE_NEXT = [
  "https://evil.example/x.html",
  "//evil.example/a.html",
  "kirish.html",
  "KIRISH.html",
  "a/b.html",
  "javascript:alert(1)",
];

function signIn(login: string, password: string): void {
  fireEvent.change(screen.getByLabelText(TEXT.ki_login[0]), { target: { value: login } });
  fireEvent.change(screen.getByLabelText(TEXT.ki_pass[0]), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: TEXT.ki_btn[0] }));
}

/* The session check answers a tick after the page mounts; this lets it land
   before a test asserts that nothing followed from it. */
async function sessionChecked(): Promise<void> {
  await waitFor(() => expect(auth.ready).toHaveBeenCalled());
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("KirishPage", () => {
  afterEach(() => setSearch(""));

  it("opens the cabinet the account belongs to, sending the pair once and keeping nothing", async () => {
    stubApi({});
    setLoginResult(COMPANY);
    renderPage(<KirishPage />);

    signIn("  alfa ", "secret-pass");

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("company.html"));
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith("alfa", "secret-pass");
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/alfa|secret-pass/);
  });

  it("puts no login or password in any request of its own", async () => {
    stubApi({});
    setLoginResult(COMPANY);
    renderPage(<KirishPage />);

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(replaceWith).toHaveBeenCalled());
    /* Only auth.login carries the pair; whatever else the page asked for must not. */
    for (const [url, options] of (fetch as unknown as FetchStub).mock.calls) {
      expect(String(url)).not.toMatch(/alfa|secret-pass|password/);
      expect(String((options as RequestInit | undefined)?.body ?? "")).not.toMatch(/login|password|secret-pass/);
    }
  });

  it("returns to a same-site ?next= page after signing in", async () => {
    setSearch("?next=bozor.html");
    stubApi({});
    setLoginResult(COMPANY);
    renderPage(<KirishPage />);

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("bozor.html"));
  });

  it.each(UNSAFE_NEXT)("ignores the unsafe ?next= %s", async next => {
    setSearch(`?next=${encodeURIComponent(next)}`);
    stubApi({});
    setLoginResult(COMPANY);
    renderPage(<KirishPage />);

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("company.html"));
    expect(replaceWith).toHaveBeenCalledTimes(1);
  });

  it("asks for both fields before contacting the server", async () => {
    stubApi({});
    renderPage(<KirishPage />);

    /* Submitted directly: the browser stops a click on an empty required
       field first, and this is the page's check behind it. */
    fireEvent.change(screen.getByLabelText(TEXT.ki_login[0]), { target: { value: "alfa" } });
    fireEvent.submit(document.querySelector("#kiForm")!);

    expect(screen.getByRole("alert").textContent).toBe(TEXT.ki_empty[0]);
    expect(auth.login).not.toHaveBeenCalled();
    await sessionChecked();
  });

  it("gives one message for a refused sign-in and clears the password", async () => {
    stubApi({});
    setLoginResult(null);
    renderPage(<KirishPage />);

    signIn("alfa", "wrong-pass");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(TEXT.ki_bad[0]));
    expect(screen.getByLabelText<HTMLInputElement>(TEXT.ki_pass[0]).value).toBe("");
    expect(replaceWith).not.toHaveBeenCalled();
  });

  it("gives the same message when the server cannot be reached", async () => {
    stubApi({});
    vi.mocked(auth.login).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderPage(<KirishPage />);

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(TEXT.ki_bad[0]));
    expect(replaceWith).not.toHaveBeenCalled();
  });

  it("refuses a target that is not a page of this site", async () => {
    stubApi({});
    setLoginResult({ ...COMPANY, target: "https://evil.example/company.html" });
    renderPage(<KirishPage />);

    signIn("alfa", "secret-pass");

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(TEXT.ki_bad[0]));
    expect(replaceWith).not.toHaveBeenCalled();
  });

  it("sends someone already signed in straight to their cabinet", async () => {
    stubApi({});
    setTestSession({ authenticated: true, role: "buyer", target: "xaridor.html", user: { id: "b1" } });

    renderPage(<KirishPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("xaridor.html"));
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("sends someone already signed in on to a safe ?next= page", async () => {
    setSearch("?next=bozor.html");
    stubApi({});
    setTestSession({ authenticated: true, role: "buyer", target: "xaridor.html" });

    renderPage(<KirishPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("bozor.html"));
  });

  it("never sends a signed-in visitor back here, and falls back to the home page without a usable cabinet", async () => {
    setSearch("?next=kirish.html");
    stubApi({});
    setTestSession({ authenticated: true, role: "buyer", target: "//evil.example/x.html" });

    renderPage(<KirishPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("index.html"));
  });

  it("leaves a guest on the form", async () => {
    stubApi({});

    renderPage(<KirishPage />);

    await sessionChecked();
    expect(replaceWith).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText(TEXT.ki_login[0]));
  });

  it("leaves a session limited to the personal-data page on the form", async () => {
    stubApi({});
    setTestSession({ authenticated: true, restricted: true, role: "company", target: "company.html" });

    renderPage(<KirishPage />);

    await sessionChecked();
    expect(replaceWith).not.toHaveBeenCalled();
  });

  it("stays usable when the session cannot be read", async () => {
    stubApi({});
    vi.mocked(auth.ready).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderPage(<KirishPage />);

    await sessionChecked();
    expect(replaceWith).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: TEXT.ki_btn[0] })).toBeTruthy();
  });

  it("follows the language switch", () => {
    stubApi({});
    localStorage.setItem("kg_lang", "ru");

    renderPage(<KirishPage />);

    expect(screen.getByRole("heading", { level: 1, name: TEXT.ki_title[1] })).toBeTruthy();
    expect(document.title).toBe(`${TEXT.ki_title[1]} — TIJORAT MARKAZI`);
  });
});
