import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setLoginResult, setTestSession } from "../../test/fakeSession";
import { renderPage, stubApi } from "../../test/renderPage";
import { parseNews } from "../cabinet/News";
import { auth } from "../session";
import { CompanyBar } from "./CompanyBar";
import { useCompany } from "./hooks";

const COMPANY = { ok: true, company: { id: "c1", name: "Alfa", sector: "Agro" } };
const SESSION = { authenticated: true, role: "company", target: "company.html", user: { id: "c1", name: "Alfa" } };
const t = (key: string): string => key;

function Strip() {
  const { company, signIn, signOut } = useCompany();
  return <CompanyBar id="bzId" prefix="bz" t={t} company={company} onSignIn={signIn} onSignOut={signOut} />;
}

function typePair(container: HTMLElement, login: string, password: string): void {
  fireEvent.change(container.querySelector("#bzLogin")!, { target: { value: login } });
  fireEvent.change(container.querySelector("#bzPass")!, { target: { value: password } });
  fireEvent.click(container.querySelector("#bzIn")!);
}

describe("useCompany with CompanyBar", () => {
  it("shows the company of a session that is already open, sector included", async () => {
    setTestSession(SESSION);
    stubApi({ "/api/company/login": COMPANY });

    renderPage(<Strip />);

    expect(await screen.findByText("Agro")).toBeTruthy();
    expect(screen.getByText("Alfa")).toBeTruthy();
  });

  it("offers the sign-in to a guest and opens the strip once the pair is accepted", async () => {
    stubApi({ "/api/company/login": COMPANY });
    setLoginResult(SESSION);
    const { container } = renderPage(<Strip />);

    typePair(container, " alfa ", "s3cret-pair");

    expect(await screen.findByText("Agro")).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("alfa", "s3cret-pair");
  });

  it("says so when the pair is refused and drops the password from the field", async () => {
    stubApi({});
    setLoginResult(null);
    const { container } = renderPage(<Strip />);

    typePair(container, "alfa", "wrong");

    expect(await screen.findByText("bz_login_fail")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#bzPass")!.value).toBe("");
  });

  it("ends the server session on sign-out", async () => {
    setTestSession(SESSION);
    stubApi({ "/api/company/login": COMPANY });
    const { container } = renderPage(<Strip />);
    await screen.findByText("Agro");

    fireEvent.click(container.querySelector("#bzOut")!);

    await waitFor(() => expect(container.querySelector("#bzIn")).toBeTruthy());
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("keeps the strip when the sign-out could not reach the server", async () => {
    setTestSession(SESSION);
    stubApi({ "/api/company/login": COMPANY });
    vi.mocked(auth.logout).mockRejectedValueOnce(new Error("offline"));
    const { container } = renderPage(<Strip />);
    await screen.findByText("Agro");

    fireEvent.click(container.querySelector("#bzOut")!);

    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1));
    expect(container.querySelector("#bzOut")).toBeTruthy();
  });
});

describe("addresses the API supplies", () => {
  it("lets a news image be an upload, a web address or an inline picture, and nothing else", () => {
    const images = parseNews([
      { image: "/uploads/a.png" },
      { image: `${window.location.origin}/uploads/b.png` },
      { image: "https://cdn.uz/c.png" },
      { image: "data:image/png;base64,AAAA" },
      { image: "data:image/svg+xml,<svg onload=alert(1)>" },
      { image: "javascript:alert(1)" },
      { image: "//evil.example/x.png" },
    ]).map(item => item.image);

    expect(images).toEqual(["/uploads/a.png", "/uploads/b.png", "https://cdn.uz/c.png", "data:image/png;base64,AAAA", "", "", ""]);
  });
});
