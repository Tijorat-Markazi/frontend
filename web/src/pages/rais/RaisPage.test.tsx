import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { replaceWith } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { setTestSession } from "../../test/fakeSession";
import { renderPage, stubApi } from "../../test/renderPage";
import { RaisPage } from "./RaisPage";
import { LINK, NOTICE } from "./text";

vi.mock("../../shell/navigate", () => ({ goTo: vi.fn(), replaceWith: vi.fn() }));

type FetchStub = ReturnType<typeof vi.fn>;

describe("RaisPage", () => {
  it.each([
    ["an overseer", { authenticated: true, role: "admin", target: "admin.html", user: { id: "a1" } }],
    ["another role", { authenticated: true, role: "company", target: "company.html", user: { id: "c1" } }],
    ["a guest", {}],
  ])("sends %s to the admin panel in place of this page, which decides who gets in", async (_who, session) => {
    stubApi({});
    setTestSession(session);

    renderPage(<RaisPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("admin.html"));
    expect(replaceWith).toHaveBeenCalledTimes(1);
  });

  it("still redirects when the session cannot be read", async () => {
    stubApi({});
    vi.mocked(auth.ready).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderPage(<RaisPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalledWith("admin.html"));
  });

  it("signs nobody in and sends no login or password", async () => {
    stubApi({});

    renderPage(<RaisPage />);

    await waitFor(() => expect(replaceWith).toHaveBeenCalled());
    expect(auth.login).not.toHaveBeenCalled();
    expect((fetch as unknown as FetchStub).mock.calls).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });

  it("shows the merge notice with a link for a browser that does not follow the redirect", () => {
    stubApi({});

    renderPage(<RaisPage />);

    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByRole("link", { name: LINK }).getAttribute("href")).toBe("admin.html");
  });

  it("carries the notice in the 2026 Uzbek alphabet", () => {
    expect(NOTICE).toMatch(/[şç]/);
    expect(LINK).toContain("Admin");
  });
});
