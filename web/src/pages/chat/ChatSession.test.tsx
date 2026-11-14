import { describe, expect, it, vi } from "vitest";
import { navigate } from "../../shell/navigate";
import { auth } from "../../shell/session";
import { signInAs } from "../../shell/cabinet/testApi";
import { setTestSession } from "../../test/fakeSession";
import { stubSocket } from "../../test/fakeSocket";
import { renderPage } from "../../test/renderPage";
import { ChatPage } from "./ChatPage";
import { message, stubGroupApi, listed, threadOf, everythingSent, flush, openChat, connect, type } from "./testKit";

describe("ChatPage session", () => {
  async function openAs(prepare: () => void) {
    const replace = vi.spyOn(navigate, "replace").mockImplementation(() => undefined);
    prepare();
    stubSocket();
    const calls = stubGroupApi({ list: listed, thread: threadOf() });
    const view = renderPage(<ChatPage />);
    await flush();
    return { ...view, calls, replace };
  }

  it("hands a guest over to the sign-in page, to come back here afterwards", async () => {
    const { container, calls, replace } = await openAs(() => undefined);

    expect(replace).toHaveBeenCalledWith("kirish.html?next=chat.html");
    expect(container.querySelector(".tg")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("does not let a session restricted to the personal-data page in", async () => {
    const { container, calls, replace } = await openAs(() =>
      setTestSession({ authenticated: true, restricted: true, role: "company", target: "mening-malumotlarim.html" }),
    );

    expect(replace).toHaveBeenCalledWith("kirish.html?next=chat.html");
    expect(container.querySelector(".tg")).toBeNull();
    expect(calls).toEqual([]);
  });

  it.each([
    ["analyst", "tahlil.html"],
    ["buyer", "xaridor.html"],
  ])("sends a signed-in %s back to their own cabinet", async (role, cabinet) => {
    const { container, calls, replace } = await openAs(() => signInAs(role));

    expect(replace).toHaveBeenCalledWith(cabinet);
    expect(container.querySelector(".tg")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("never follows a cabinet address that is not a page of this site", async () => {
    const { replace } = await openAs(() =>
      setTestSession({ authenticated: true, role: "analyst", target: "https://evil.example/x.html" }),
    );

    expect(replace).toHaveBeenCalledWith("index.html");
  });

  it.each([
    ["admin", "admin.html"],
    ["rais", "admin.html"],
    ["assoc", "association.html"],
    ["company", "company.html"],
  ])("lets a signed-in %s in and links back to that cabinet", async (role, cabinet) => {
    const { container, calls, replace } = await openAs(() => signInAs(role));

    expect(replace).not.toHaveBeenCalled();
    expect(calls[0]).toEqual({ op: "list", lang: "uz" });
    expect(container.querySelector(".tg-back")?.getAttribute("href")).toBe(cabinet);
    expect(document.body.classList.contains("chat-page")).toBe(true);
  });

  it("takes no identity from browser storage", async () => {
    const { container, replace } = await openAs(() => {
      sessionStorage.setItem("kg_admin", "1");
      sessionStorage.setItem("kg_co", JSON.stringify({ login: "acme", password: "pw" }));
    });

    expect(replace).toHaveBeenCalledWith("kirish.html?next=chat.html");
    expect(container.querySelector(".tg")).toBeNull();
  });

  it("says why when the session cannot be read", async () => {
    vi.mocked(auth.ready).mockRejectedValueOnce(new Error("Session service unavailable"));
    const { container, replace } = await openAs(() => undefined);

    expect(container.querySelector("#chatRoot")?.textContent).toBe("Session service unavailable");
    expect(replace).not.toHaveBeenCalled();
  });

  it("carries no login or password in any request, socket frame or storage", async () => {
    const { container, calls, latest } = await openChat({
      list: listed,
      thread: threadOf(),
      send: body => ({ ok: true, messages: [message("m1", String(body.text))] }),
    });
    type(container, "Salom");
    await flush();
    const socket = await connect(latest);
    type(container, "Yana");

    expect(calls.map(call => call.op)).toContain("send");
    expect(socket.sent.at(-1)).toMatchObject({ op: "send", text: "Yana" });
    expect(everythingSent(calls, socket.sent)).not.toMatch(/login|password|pass"|acme|creds/i);
  });
});
