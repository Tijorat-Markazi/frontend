import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bodiesSentTo, refused } from "../../shell/cabinet/testApi";
import { dialogs } from "../../shell/dialogs";
import { auth } from "../../shell/session";
import { HOSTILE, setSearch } from "../../test/renderPage";
import { USAGE, ASK, SESSIONS, flush, enterDemo, askQuestion, isHidden, statusOf } from "./testKit";

afterEach(() => setSearch(""));

describe("AssistantPage demo chat", () => {
  it("enters as a guest of the session, with the free questions counted by the server", async () => {
    const { container, calls } = await enterDemo();

    expect(auth.guest).toHaveBeenCalledWith("ali@gmail.com", "");
    expect(bodiesSentTo(calls, USAGE)).toEqual([{}]);
    const stored = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    expect(stored.filter(key => /email|guest|admin|kg_(co|as|an|by)/.test(key))).toEqual([]);
    expect(JSON.stringify([localStorage, sessionStorage])).not.toContain("gmail");
    expect(container.querySelector("#uEmail")?.textContent).toBe("ali@gmail.com");
    expect(container.querySelector("#aiStatus")?.textContent).toBe("AI faol · Claude");
    expect(isHidden(container, "#histPanel")).toBe(true);
    expect(container.querySelector("#limitNote")?.textContent).toBe("Bepul savollar: 2/3 qoldi");
    expect(container.querySelectorAll("#exList button")).toHaveLength(5);
    expect(calls.some(call => call.url.startsWith(SESSIONS))).toBe(false);
  });

  it("sends a question with the conversation so far and shows the answer", async () => {
    const answer = { reply: "Birinchi qator\nIkkinchi qator", max: 3, used: 2, remaining: 1 };
    const { container, calls } = await enterDemo({ [ASK]: answer });

    await askQuestion(container, "Salom");
    await askQuestion(container, "Yana");

    expect(bodiesSentTo(calls, ASK)[0]).toEqual({ message: "Salom", history: [], lang: "uz", attachment: null });
    expect(bodiesSentTo(calls, ASK)[1]).toEqual({
      message: "Yana",
      history: [
        { role: "user", text: "Salom" },
        { role: "assistant", text: answer.reply },
      ],
      lang: "uz",
      attachment: null,
    });
    const bubbles = [...container.querySelectorAll("#chatBody .msg")];
    expect(bubbles[1].className).toBe("msg user");
    expect(bubbles[1].textContent).toBe("Salom");
    expect(bubbles[2].querySelectorAll("br")).toHaveLength(1);
    expect(bubbles[2].textContent).toBe("Birinchi qatorIkkinchi qator");
    expect(container.querySelector("#limitNote")?.textContent).toBe("Bepul savollar: 1/3 qoldi");
    expect(statusOf(container)).toBe("onlayn");
  });

  it("reports why a question failed and invents no answer", async () => {
    const { container } = await enterDemo({ [ASK]: refused(429, { error: "rate_limited" }) });

    await askQuestion(container, "Salom");

    const bubbles = [...container.querySelectorAll("#chatBody .msg")];
    expect(bubbles.map(bubble => bubble.className)).toEqual(["msg bot", "msg user"]);
    expect(statusOf(container)).toBe("rate_limited");
    expect(container.querySelector("#chatBody .typing")).toBeNull();
    expect(isHidden(container, "#stopBtn")).toBe(true);
  });

  it("treats an answer without a reply as a failure", async () => {
    const { container } = await enterDemo({ [ASK]: { ok: true } });

    await askQuestion(container, "Salom");

    expect(container.querySelectorAll("#chatBody .msg")).toHaveLength(2);
    expect(statusOf(container)).toBe("Service unavailable. Please try again.");
  });

  it("renders a hostile answer as text", async () => {
    const { container } = await enterDemo({ [ASK]: { reply: `${HOSTILE} [x](javascript:alert(1))` } });

    await askQuestion(container, HOSTILE);

    expect(container.querySelector("#chatBody img")).toBeNull();
    expect(container.querySelector("#chatBody a")).toBeNull();
    expect(container.querySelector("#chatBody .msg.user")?.textContent).toBe(HOSTILE);
    expect(container.querySelector("#chatBody .msg.bot:last-child")?.textContent).toContain(HOSTILE);
  });

  it("turns a generated document into a download card and drops anything outside /uploads/", async () => {
    const reply = "Tayyor: [Reja](/uploads/reja.docx)";
    const files = [
      { url: "/uploads/reja.docx", name: HOSTILE, size: 2048 },
      { url: "javascript:alert(1)", name: "x" },
      { url: "https://evil.example/uploads/x.pdf", name: "y" },
      { url: "/api/admin/export", name: "z" },
    ];
    const { container } = await enterDemo({ [ASK]: { reply, files } });

    await askQuestion(container, "Reja yoz");

    const cards = [...container.querySelectorAll<HTMLAnchorElement>(".msg-file")];
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("href")).toBe("/uploads/reja.docx");
    expect(cards[0].querySelector("b")?.textContent).toBe(HOSTILE);
    expect(cards[0].querySelector("em")?.textContent).toBe("2 KB");
    expect(container.querySelector("#chatBody img")).toBeNull();
  });

  it("closes the composer once the free questions are spent", async () => {
    const { container } = await enterDemo({ [USAGE]: { privileged: false, max: 3, used: 3, remaining: 0 } });

    expect(container.querySelector<HTMLInputElement>("#chatText")?.disabled).toBe(true);
    expect(container.querySelector("#chatText")?.getAttribute("placeholder")).toBe("Bepul 3 ta savol limiti tugadi.");
    expect(container.querySelector("#limitNote")?.className).toBe("limit-note is-over");
    expect(container.querySelector<HTMLButtonElement>("#micBtn")?.disabled).toBe(true);
  });

  it("refuses a file type it cannot read", async () => {
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    const { container } = await enterDemo();

    fireEvent.change(container.querySelector("#fileInput")!, { target: { files: [new File(["x"], "app.exe")] } });
    await flush();

    expect(alert).toHaveBeenCalledWith("Bu fayl turi qöllab-quvvatlanmaydi");
    expect(isHidden(container, "#attachChip")).toBe(true);
  });

  it("refuses a file over 8 MiB before reading it", async () => {
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    const { container } = await enterDemo();
    const file = new File(["x"], "big.pdf");
    Object.defineProperty(file, "size", { value: 8 * 1024 * 1024 + 1 });

    fireEvent.change(container.querySelector("#fileInput")!, { target: { files: [file] } });
    await flush();

    expect(alert).toHaveBeenCalledWith("File too large (8 MiB max)");
    expect(isHidden(container, "#attachChip")).toBe(true);
  });

  it("ends the guest session and returns to the sign-in card on request", async () => {
    const { container } = await enterDemo();

    fireEvent.click(container.querySelector("#switchEmail")!);
    await flush();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(isHidden(container, "#asstLogin")).toBe(false);
    expect(isHidden(container, "#asstApp")).toBe(true);
  });
});
