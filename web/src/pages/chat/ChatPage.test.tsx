import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dialogs } from "../../shell/dialogs";
import { signInAs } from "../../shell/cabinet/testApi";
import { stubSocket } from "../../test/fakeSocket";
import { HOSTILE, renderPage } from "../../test/renderPage";
import { ChatPage } from "./ChatPage";
import { ROOM, ME, ROOMS, message, stubGroupApi, listed, threadOf, flush, openChat, connect, type } from "./testKit";

describe("ChatPage rooms", () => {
  it("says so when the room list cannot be loaded", async () => {
    const { container } = await openChat({});

    expect(container.querySelector("#tgList .tg-note.bad")?.textContent).toBe("Yuborilmadi — qayta urinib köring.");
  });

  it("says so when the account is in no room", async () => {
    const { container } = await openChat({ list: () => ({ ok: true, me: ME, groups: [] }) });

    expect(container.querySelector("#tgBody .tg-note")?.textContent).toBe("Siz heç qaysi guruhda emassiz.");
  });

  it("opens the first room and lists its members, marking observers", async () => {
    const { container, calls } = await openChat({ list: listed, thread: threadOf(message("m1", "Salom")) });

    expect(calls.some(call => call.op === "thread" && call.group === ROOM)).toBe(true);
    expect(container.querySelector(".tg-head-sub")?.textContent).toBe("Acme, Karim, Rais (kuzatuvçi)");
    expect(screen.getByText("Salom")).toBeTruthy();
    expect(container.querySelector(".tg")?.className).toBe("tg open");
  });

  it("filters the room list by title", async () => {
    const { container } = await openChat({ list: listed, thread: threadOf() });

    fireEvent.change(container.querySelector("#tgSearch")!, { target: { value: "zzz" } });

    expect(container.querySelectorAll(".tg-room")).toHaveLength(0);
    expect(container.querySelector("#tgList .tg-note")?.textContent).toBe("—");
  });

  it("opens a direct chat with a member under an id both sides derive", async () => {
    const { container, calls } = await openChat({ list: listed, thread: threadOf() });

    fireEvent.click(container.querySelector("#tgHeadBtn")!);
    const people = [...container.querySelectorAll<HTMLButtonElement>(".tg-person")];
    expect(people[0].disabled).toBe(true);
    fireEvent.click(people[1]);
    await flush();

    expect(calls.at(-1)).toMatchObject({ op: "thread", group: "dm:a1|c1" });
    expect(container.querySelector(".tg-room.on b")?.textContent).toBe("Karim");
  });
});

describe("ChatPage messages", () => {
  it("signs the socket in, then sends a message through it and shows the echo", async () => {
    const { container, latest } = await openChat({ list: listed, thread: threadOf(message("m1", "Salom")) });
    const socket = await connect(latest);

    expect(socket.sent[0]).toEqual({ op: "auth" });
    expect(socket.sent[1]).toEqual({ op: "read", group: ROOM, id: "m1" });

    type(container, "  Buyurtma tayyor  ");
    expect(socket.sent.at(-1)).toEqual({ op: "send", group: ROOM, text: "Buyurtma tayyor", attach: null });
    expect(container.querySelector<HTMLInputElement>("#tgInput")?.value).toBe("");

    const echo = { id: "m2", from: "company", fromId: "c1", fromName: "Acme", text: "Buyurtma tayyor", time: Date.now() };
    await act(async () => socket.receive({ op: "new", group: ROOM, msg: echo }));

    const mine = container.querySelector(".tg-msg.mine");
    expect(mine?.querySelector(".tg-text")?.textContent).toBe("Buyurtma tayyor");
    expect(mine?.querySelector(".tg-ticks")?.textContent).toBe("✓");
    expect(socket.sent.at(-1)).toEqual({ op: "read", group: ROOM, id: "m2" });
  });

  it("applies edits, read receipts and deletes that arrive on the socket", async () => {
    const own = { id: "m1", from: "company", fromId: "c1", fromName: "Acme", text: "Bir", time: Date.now() };
    const { container, latest } = await openChat({ list: listed, thread: threadOf(own) });
    const socket = await connect(latest);

    await act(async () => socket.receive({ op: "edit", group: ROOM, msg: { ...own, text: "Ikki", edited: true } }));
    expect(container.querySelector(".tg-text")?.textContent).toBe("Ikki");
    expect(container.querySelector(".tg-edited")?.textContent).toBe("tahrirlangan");

    await act(async () => socket.receive({ op: "read", group: ROOM, ids: ["m1"], by: { id: "a1", name: "Karim" } }));
    expect(container.querySelector(".tg-ticks")?.textContent).toBe("✓✓");
    expect(container.querySelector(".tg-ticks")?.getAttribute("title")).toBe("Öqidi: Karim");

    await act(async () => socket.receive({ op: "delete", group: ROOM, msg: { id: "m1" } }));
    expect(container.querySelector(".tg-msg")).toBeNull();
  });

  it("ignores a message for a room that is not open", async () => {
    const { container, latest, calls } = await openChat({ list: listed, thread: threadOf() });
    const socket = await connect(latest);
    const listCalls = calls.filter(call => call.op === "list").length;

    await act(async () => socket.receive({ op: "new", group: "chairmen", msg: message("m9", "Boshqa xona") }));
    await flush();

    expect(screen.queryByText("Boshqa xona")).toBeNull();
    expect(container.querySelector("#tgBody .tg-note")?.textContent).toBe("Hali xabar yöq. Birinçi bölib yozing.");
    expect(calls.filter(call => call.op === "list").length).toBe(listCalls + 1);
  });

  it("shows who is typing", async () => {
    const { container, latest } = await openChat({ list: listed, thread: threadOf() });
    const socket = await connect(latest);

    await act(async () => socket.receive({ op: "typing", group: ROOM, who: HOSTILE }));

    expect(container.querySelector(".tg-typing span")?.textContent).toBe(`${HOSTILE} yozmoqda…`);
    expect(container.querySelector(".tg-typing img")).toBeNull();
  });

  it("falls back to HTTP without a socket, and keeps the text when the request fails", async () => {
    const { container, calls } = await openChat({ list: listed, thread: threadOf() });

    type(container, "Salom");
    await flush();

    expect(calls.at(-1)).toEqual({ op: "send", group: ROOM, text: "Salom", attach: null, lang: "uz" });
    expect(container.querySelector("#tgBody .tg-note.bad")?.textContent).toBe("Yuborilmadi — qayta urinib köring.");
    expect(container.querySelector<HTMLInputElement>("#tgInput")?.value).toBe("Salom");
  });

  it("shows the thread the server answers with when sending over HTTP", async () => {
    const { container } = await openChat({
      list: listed,
      thread: threadOf(),
      send: body => ({ ok: true, messages: [message("m1", String(body.text))] }),
    });

    type(container, "Salom");
    await flush();

    expect(container.querySelector(".tg-text")?.textContent).toBe("Salom");
  });

  it("replies to a message, quoting it in what is sent", async () => {
    const { container, latest } = await openChat({ list: listed, thread: threadOf(message("m1", "Savol")) });
    const socket = await connect(latest);

    fireEvent.click(container.querySelector(".tg-more")!);
    const menu = [...container.querySelectorAll<HTMLButtonElement>(".tg-menu > button")];
    expect(menu.map(button => button.textContent)).toEqual(["Javob beriş"]);
    fireEvent.click(menu[0]);
    expect(container.querySelector("#tgReply")?.textContent).toContain("Savol");

    type(container, "Javob");
    expect(socket.sent.at(-1)).toEqual({
      op: "send",
      group: ROOM,
      text: "Javob",
      attach: null,
      reply: { id: "m1", name: "Karim", text: "Savol" },
    });
    expect(container.querySelector<HTMLElement>("#tgReply")?.hidden).toBe(true);
  });

  it("lets a moderator delete after confirming, and reacts from the menu", async () => {
    signInAs("admin");
    const latest = stubSocket();
    const admin = { type: "admin", id: "admin", name: "Administrator" };
    stubGroupApi({
      list: () => ({ ok: true, me: admin, groups: ROOMS }),
      thread: () => ({ ok: true, me: admin, messages: [message("m1", "Savol")] }),
    });
    vi.spyOn(dialogs, "confirm").mockResolvedValue(true);
    const { container } = renderPage(<ChatPage />);
    await flush();
    const socket = await connect(latest);

    fireEvent.click(container.querySelector(".tg-more")!);
    fireEvent.click(container.querySelector(".tg-menu-quick button")!);
    expect(socket.sent.at(-1)).toEqual({ op: "react", id: "m1", emoji: "👍", group: ROOM });

    fireEvent.click(container.querySelector(".tg-more")!);
    fireEvent.click(container.querySelector(".tg-menu .bad")!);
    await flush();
    expect(socket.sent.at(-1)).toEqual({ op: "delete", id: "m1", group: ROOM });
  });
});

describe("ChatPage hostile input", () => {
  it("renders names, text, quotes and reactions from the server as text", async () => {
    const hostile = message("m1", `${HOSTILE} [x](javascript:alert(1))`, {
      fromName: HOSTILE,
      from: 'x" onclick="alert(1)',
      reply: { name: HOSTILE, text: HOSTILE },
      reactions: { [HOSTILE]: [{ id: "a1", name: HOSTILE }] },
      att: { kind: "image", url: "javascript:alert(1)", name: HOSTILE },
    });
    const rooms = [{ ...ROOMS[0], title: HOSTILE, last: HOSTILE, lastFrom: HOSTILE }];
    const { container } = await openChat({ list: () => ({ ok: true, me: ME, groups: rooms }), thread: threadOf(hostile) });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".tg-msg a")).toBeNull();
    expect(container.querySelector(".tg-msg [onclick]")).toBeNull();
    expect(container.querySelector(".tg-from")?.textContent).toContain(HOSTILE);
    expect(container.querySelector(".tg-text")?.textContent).toBe(`${HOSTILE} [x](javascript:alert(1))`);
    expect(container.querySelector(".tg-room b")?.textContent).toBe(HOSTILE);
    expect(container.querySelector(".tg-react")?.textContent).toBe(`${HOSTILE}1`);
  });

  it("shows a socket error as text and stays quiet about a refused room", async () => {
    const { container, latest } = await openChat({ list: listed, thread: threadOf() });
    const socket = await connect(latest);

    await act(async () => {
      socket.receive({ op: "error", error: "forbidden" });
      socket.receive({ op: "error", error: HOSTILE });
    });

    const notes = [...container.querySelectorAll("#tgBody .tg-note.bad")];
    expect(notes.map(note => note.textContent)).toEqual([HOSTILE]);
    expect(container.querySelector("#tgBody img")).toBeNull();
  });
});
