import { describe, expect, it, vi } from "vitest";
import { setLoginResult } from "../test/fakeSession";
import { resolveLogin } from "./resolveLogin";
import { auth } from "./session";

describe("resolveLogin", () => {
  it("resolves to the cabinet the server names for the account", async () => {
    setLoginResult({ role: "assoc", target: "association.html" });

    expect(await resolveLogin("  uyushma ", "pair")).toBe("association.html");
    expect(auth.login).toHaveBeenCalledWith("uyushma", "pair");
  });

  it("resolves to null when the pair is refused or the server cannot be reached", async () => {
    setLoginResult(null);
    expect(await resolveLogin("uyushma", "wrong")).toBeNull();

    vi.mocked(auth.login).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await resolveLogin("uyushma", "pair")).toBeNull();
  });

  it("never names a page outside this site", async () => {
    setLoginResult({ role: "admin", target: "//evil.example/admin.html" });
    expect(await resolveLogin("boss", "pair")).toBeNull();

    setLoginResult({ role: "admin", target: undefined });
    expect(await resolveLogin("boss", "pair")).toBeNull();
  });

  it("does not ask the server about an empty form", async () => {
    expect(await resolveLogin("  ", "")).toBeNull();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("stores nothing", async () => {
    setLoginResult({ role: "company", target: "company.html" });

    await resolveLogin("alfa", "s3cret-pair");

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
