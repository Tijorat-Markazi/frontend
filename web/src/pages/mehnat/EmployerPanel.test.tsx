import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dialogs } from "../../shell/dialogs";
import { navigate } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { resetTestSession, setLoginResult, setTestSession } from "../../test/fakeSession";
import { HOSTILE, stubApi } from "../../test/renderPage";
import {
  asCompany,
  COMPANY_ANSWER,
  EMPLOYER,
  forgetContact,
  JOBS,
  LISTING,
  openTab,
  postsTo,
  renderJobs,
  SECRET,
  sentRequests,
  uz,
} from "./testKit";

afterEach(forgetContact);

describe("MehnatPage employer cabinet", () => {
  const EMPLOYER_ROUTES = {
    "/api/mehnat/meta": { stages: ["applied", "offer", "rejected"] },
    "/api/mehnat/employer": EMPLOYER,
    "/api/mehnat/stage": { ok: true },
    "/api/company/login": COMPANY_ANSWER,
  };

  const typePair = (container: HTMLElement, login: string, password: string): void => {
    fireEvent.change(container.querySelector("#hcLogin")!, { target: { value: login } });
    fireEvent.change(container.querySelector("#hcPass")!, { target: { value: password } });
    fireEvent.click(container.querySelector("#hcIn")!);
  };

  async function renderBoard() {
    asCompany();
    const view = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");
    await screen.findByText(HOSTILE);
    return view;
  }

  it("shows the pipeline with candidate names as text", async () => {
    const { container } = await renderBoard();

    expect(container.querySelector("#hcEmployer img")).toBeNull();
    expect(container.querySelectorAll("#hcEmployer .mk-box.w3")).toHaveLength(2);
    expect(postsTo("/api/mehnat/employer")[0]).toEqual({});
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("keeps the sign-in fields and explains a refused login", async () => {
    const { container } = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");

    typePair(container, "alfa", "wrong");

    expect(await screen.findByText(uz("hc_login_fail"))).toBeTruthy();
    expect(container.querySelector("#hcLogin")).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>("#hcPass")?.value).toBe("");
    expect(postsTo("/api/mehnat/employer")).toHaveLength(0);
  });

  it("signs a company in through the session and opens its board", async () => {
    setLoginResult({ role: "company", target: "company.html", user: { id: "c1", name: "Alfa" } });
    const { container } = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");

    typePair(container, " alfa ", SECRET);

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(auth.login).toHaveBeenCalledWith("alfa", SECRET);
    expect(postsTo("/api/company/login")).toEqual([{}]);
    expect(container.querySelector("#hcEmpId")?.textContent).toContain("Agro");
  });

  it("asks a guest and an account of another kind to sign in, and loads no board", async () => {
    setTestSession({ authenticated: true, role: "buyer", target: "xaridor.html", user: { id: "b1", name: "Xaridor" } });
    const { container } = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");

    expect(await screen.findByText(uz("hc_login_needed"))).toBeTruthy();
    expect(container.querySelector("#hcLogin")).not.toBeNull();

    act(() => resetTestSession());

    expect(container.querySelector("#hcLogin")).not.toBeNull();
    expect(postsTo("/api/mehnat/employer")).toHaveLength(0);
    expect(postsTo("/api/company/login")).toHaveLength(0);
  });

  it("sends a pair that belongs to another kind of account to its own page", async () => {
    const goTo = vi.spyOn(navigate, "to").mockImplementation(() => undefined);
    setLoginResult({ role: "buyer", target: "xaridor.html", user: { id: "b1" } });
    const { container } = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");

    typePair(container, "xaridor", SECRET);

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("xaridor.html"));
    expect(postsTo("/api/mehnat/employer")).toHaveLength(0);
  });

  it("asks to sign in again when the board is refused, without ending the session", async () => {
    asCompany();
    const { container } = await renderJobs({ ...EMPLOYER_ROUTES, "/api/mehnat/employer": 401 });
    openTab("hc_tab_employer");

    expect(await screen.findByText(uz("hc_login_needed"))).toBeTruthy();
    expect(container.querySelector("#hcOut")).not.toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("ends the session when the company signs out", async () => {
    const { container } = await renderBoard();

    fireEvent.click(container.querySelector("#hcOut")!);

    await waitFor(() => expect(container.querySelector("#hcLogin")).not.toBeNull());
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText(uz("hc_login_needed"))).toBeTruthy();
  });

  it("puts no login or password in any request or in browser storage", async () => {
    setLoginResult({ role: "company", target: "company.html", user: { id: "c1", name: "Alfa" } });
    vi.spyOn(dialogs, "prompt").mockResolvedValue("skill");
    const { container } = await renderJobs(EMPLOYER_ROUTES);
    openTab("hc_tab_employer");
    typePair(container, "alfa", SECRET);
    await screen.findByText(HOSTILE);
    fireEvent.change(container.querySelector('[data-stage-for="a1"]')!, { target: { value: "rejected" } });
    await waitFor(() => expect(postsTo("/api/mehnat/stage")).toHaveLength(1));

    const requests = sentRequests();
    expect(requests.length).toBeGreaterThan(3);
    for (const { url, body } of requests) {
      expect(url).not.toMatch(/[?&](login|password)=/);
      expect(body).not.toHaveProperty("login");
      expect(body).not.toHaveProperty("password");
    }
    expect(JSON.stringify([requests, { ...sessionStorage }, { ...localStorage }])).not.toContain(SECRET);
  });

  it("moves a candidate to rejected with the recruiter's reason", async () => {
    vi.spyOn(dialogs, "prompt").mockResolvedValue("skill");
    const { container } = await renderBoard();

    fireEvent.change(container.querySelector('[data-stage-for="a1"]')!, { target: { value: "rejected" } });

    await waitFor(() =>
      expect(postsTo("/api/mehnat/stage")[0]).toEqual({
        id: "a1",
        stage: "rejected",
        reason: "skill",
        salary: "",
      }),
    );
  });

  it("leaves the candidate where they were when no reason is given", async () => {
    const prompt = vi.spyOn(dialogs, "prompt").mockResolvedValue(null);
    const { container } = await renderBoard();
    const select = container.querySelector<HTMLSelectElement>('[data-stage-for="a1"]')!;

    fireEvent.change(select, { target: { value: "rejected" } });

    await waitFor(() => expect(prompt).toHaveBeenCalled());
    expect(postsTo("/api/mehnat/stage")).toHaveLength(0);
    expect(select.value).toBe("applied");
  });

  it("publishes a vacancy and shows the server's warnings", async () => {
    const { container } = await renderBoard();
    stubApi({ ...EMPLOYER_ROUTES, [JOBS]: LISTING, "/api/mehnat/vacancy": { ok: true, warnings: ["Maosh ko'rsatilmagan"] } });
    fireEvent.change(container.querySelector("#vcTitle")!, { target: { value: "Hisobchi" } });

    fireEvent.submit(container.querySelector("#hcVacForm")!);

    expect(await screen.findByText("Maosh ko'rsatilmagan")).toBeTruthy();
    expect(screen.getByText(uz("hc_save_ok"))).toBeTruthy();
    expect(postsTo("/api/mehnat/vacancy")[0]).toMatchObject({
      title: "Hisobchi",
      seniority: "middle",
      headcount: "1",
    });
  });
});
