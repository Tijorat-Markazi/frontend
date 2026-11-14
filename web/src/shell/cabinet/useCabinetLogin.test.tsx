import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { renderPage } from "../../test/renderPage";
import { dialogs } from "../dialogs";
import { navigate } from "../navigate";
import { auth } from "../session";
import { signInAs, stubCabinetApi } from "./testApi";
import { cabinetPost, CabinetLogin, useCabinetLogin } from "./index";

const ACCOUNT_API = "/api/test/login";

function LoginHarness({ role = "assoc" }: { role?: string | readonly string[] }) {
  const { state, submit, signOut } = useCabinetLogin<{ name: string }>({
    role,
    ownPage: "own.html",
    signIn: async () => {
      const answer = await cabinetPost(ACCOUNT_API);
      return answer.isOk ? { name: `Hello ${String(answer.body.name)}` } : null;
    },
  });
  if (state.status === "checking") return <p>checking</p>;
  if (state.status === "signedOut") {
    return <CabinetLogin idPrefix="tt" title="Sign in" lead="lead" buttonLabel="Go" errorText="Wrong pair" onSubmit={submit} />;
  }
  return (
    <button type="button" onClick={() => void signOut()}>
      {state.account.name}
    </button>
  );
}

function fillLogin(container: HTMLElement, login: string, password: string): void {
  container.querySelector<HTMLInputElement>("#ttLoginInp")!.value = login;
  container.querySelector<HTMLInputElement>("#ttPassInp")!.value = password;
  fireEvent.submit(container.querySelector("#ttForm")!);
}

const storedText = (): string => JSON.stringify([{ ...sessionStorage }, { ...localStorage }]);

describe("useCabinetLogin with CabinetLogin", () => {
  it("opens the cabinet for a session that already holds the role", async () => {
    signInAs("assoc", { id: "a1", name: "Paxta" });
    const calls = stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });

    renderPage(<LoginHarness />);

    expect(screen.getByText("checking")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Hello Paxta" })).toBeTruthy();
    expect(calls).toEqual([{ url: ACCOUNT_API, method: "POST", body: {} }]);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("accepts any of several roles", async () => {
    signInAs("rais", { id: "rais" });
    stubCabinetApi({ [ACCOUNT_API]: { name: "Rais" } });

    renderPage(<LoginHarness role={["admin", "rais"]} />);

    expect(await screen.findByRole("button", { name: "Hello Rais" })).toBeTruthy();
  });

  it("stays on the form for a guest, another role and a restricted session", async () => {
    const calls = stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });

    const guest = renderPage(<LoginHarness />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    guest.unmount();

    signInAs("company", { id: "c1" });
    const other = renderPage(<LoginHarness />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    other.unmount();

    setTestSession({ authenticated: true, role: "assoc", restricted: true, user: { id: "a1" } });
    renderPage(<LoginHarness />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();

    expect(calls).toEqual([]);
  });

  it("shows the form when the server no longer knows the account behind the session", async () => {
    signInAs("assoc", { id: "a1" });
    stubCabinetApi({ [ACCOUNT_API]: 401 });

    renderPage(<LoginHarness />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("shows the form when the session service cannot be reached", async () => {
    vi.mocked(auth.ready).mockRejectedValueOnce(new Error("Session service unavailable"));
    stubCabinetApi({});

    renderPage(<LoginHarness />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("signs in through the session and keeps no credential anywhere", async () => {
    const calls = stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });
    setLoginResult({ role: "assoc", target: "own.html", user: { id: "a1" } });
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, " alfa ", "s3cret-pair");

    expect(await screen.findByRole("button", { name: "Hello Paxta" })).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("alfa", "s3cret-pair");
    expect(calls).toEqual([{ url: ACCOUNT_API, method: "POST", body: {} }]);
    expect(storedText()).not.toContain("s3cret-pair");
    expect(storedText()).not.toContain("alfa");
  });

  it("empties the password field as soon as it is handed over", async () => {
    stubCabinetApi({});
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, "alfa", "wrong");

    expect(await screen.findByText("Wrong pair")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#ttPassInp")!.value).toBe("");
  });

  it("says so when no tier accepts the pair", async () => {
    const calls = stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });
    setLoginResult(null);
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, "alfa", "wrong");

    expect(await screen.findByText("Wrong pair")).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("says so when the session is this cabinet's but the account will not load", async () => {
    stubCabinetApi({ [ACCOUNT_API]: 403 });
    setLoginResult({ role: "assoc", target: "own.html" });
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, "alfa", "right");

    expect(await screen.findByText("Wrong pair")).toBeTruthy();
  });

  it("sends another tier's account to its own cabinet", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    const calls = stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });
    setLoginResult({ role: "admin", target: "admin.html" });
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, "boss", "other");

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("admin.html"));
    expect(calls).toEqual([]);
    expect(screen.queryByText("Wrong pair")).toBeNull();
  });

  it("never follows a target that is not a page of this site", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    stubCabinetApi({});
    setLoginResult({ role: "admin", target: "https://evil.example/admin.html" });
    const { container } = renderPage(<LoginHarness />);
    await screen.findByRole("heading", { name: "Sign in" });

    fillLogin(container, "boss", "other");

    expect(await screen.findByText("Wrong pair")).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("signs out on the server and shows the form again", async () => {
    signInAs("assoc", { id: "a1" });
    stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });
    renderPage(<LoginHarness />);

    fireEvent.click(await screen.findByRole("button", { name: "Hello Paxta" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.current()?.authenticated).toBe(false);
  });

  it("keeps the cabinet open and says why when signing out fails", async () => {
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    signInAs("assoc", { id: "a1" });
    stubCabinetApi({ [ACCOUNT_API]: { name: "Paxta" } });
    vi.mocked(auth.logout).mockRejectedValueOnce(new Error("offline"));
    renderPage(<LoginHarness />);

    fireEvent.click(await screen.findByRole("button", { name: "Hello Paxta" }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("offline"));
    expect(screen.getByRole("button", { name: "Hello Paxta" })).toBeTruthy();
  });
});
