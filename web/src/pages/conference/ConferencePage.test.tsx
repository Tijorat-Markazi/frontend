import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOSTILE, renderPage, stubApi } from "../../test/renderPage";
import { auth, setTestSession } from "../../test/fakeSession";
import { ConferencePage } from "./ConferencePage";
import { formatConferenceTime } from "./ConferenceCard";

const API = "/api/conference";
const NOW = new Date("2030-01-01T09:00:00").getTime();
const at = (time: string): string => `2030-01-01T${time}:00`;

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

function joinAsGuest(): void {
  setTestSession({ guest: { email: "ali@x.uz" } });
}

describe("ConferencePage gate", () => {
  it("shows neither gate nor conference until the session is known", () => {
    stubApi({});
    auth.ready.mockImplementationOnce(() => new Promise(() => undefined));

    const { container } = renderPage(<ConferencePage />);

    expect(container.querySelector<HTMLElement>("#confLogin")?.hidden).toBe(true);
    expect(container.querySelector<HTMLElement>("#confApp")?.hidden).toBe(true);
  });

  it("asks a new guest for an email and focuses the field", async () => {
    stubApi({});

    const { container } = renderPage(<ConferencePage />);
    await flush();

    expect(container.querySelector<HTMLElement>("#confLogin")?.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>("#confApp")?.hidden).toBe(true);
    expect(document.activeElement?.id).toBe("emailInput");
  });

  it("shows the session error at the gate when the session cannot load", async () => {
    stubApi({});
    auth.ready.mockImplementationOnce(() => Promise.reject(new Error("Session service unavailable")));

    renderPage(<ConferencePage />);

    expect(await screen.findByText("Session service unavailable")).toBeTruthy();
  });

  it("rejects an invalid email without contacting the server", async () => {
    stubApi({});
    const { container } = renderPage(<ConferencePage />);
    await flush();

    fireEvent.change(container.querySelector("#emailInput")!, { target: { value: "a@b" } });
    fireEvent.submit(container.querySelector("#emailForm")!);

    expect(await screen.findByText("Töğri email kiriting")).toBeTruthy();
    expect(auth.guest).not.toHaveBeenCalled();
  });

  it("registers a valid email on the session, lowercased, and stores nothing locally", async () => {
    stubApi({ [API]: {} });
    const { container } = renderPage(<ConferencePage />);
    await flush();

    fireEvent.change(container.querySelector("#emailInput")!, { target: { value: " Ali@X.uz " } });
    fireEvent.submit(container.querySelector("#emailForm")!);
    await flush();

    expect(auth.guest).toHaveBeenCalledWith("ali@x.uz", "");
    expect(container.querySelector("#uEmail")?.textContent).toBe("ali@x.uz");
    expect(localStorage.getItem("kg_email")).toBeNull();
  });

  it("shows the server's message when registering the email fails", async () => {
    stubApi({});
    auth.guest.mockImplementationOnce(() => Promise.reject(new Error("Server rejected it")));
    const { container } = renderPage(<ConferencePage />);
    await flush();

    fireEvent.change(container.querySelector("#emailInput")!, { target: { value: "ali@x.uz" } });
    fireEvent.submit(container.querySelector("#emailForm")!);

    expect(await screen.findByText("Server rejected it")).toBeTruthy();
    expect(container.querySelector<HTMLElement>("#confApp")?.hidden).toBe(true);
  });

  it("returns to the gate when switching email", async () => {
    joinAsGuest();
    stubApi({ [API]: {} });
    const { container } = renderPage(<ConferencePage />);
    await flush();

    fireEvent.click(container.querySelector("#switchEmail")!);

    expect(container.querySelector<HTMLElement>("#confLogin")?.hidden).toBe(false);
  });

  it("lets a signed-in account straight in with no way to switch", async () => {
    setTestSession({ authenticated: true, role: "company", user: { name: "Alfa MChJ" } });
    stubApi({ [API]: {} });

    const { container } = renderPage(<ConferencePage />);
    await flush();

    await waitFor(() => expect(container.querySelector<HTMLElement>("#confApp")?.hidden).toBe(false));
    expect(container.querySelector("#uEmail")?.textContent).toBe("Alfa MChJ");
    expect(container.querySelector<HTMLElement>("#switchEmail")?.hidden).toBe(true);
  });
});

describe("ConferencePage card", () => {
  afterEach(() => vi.useRealTimers());

  async function renderAt(conference: object) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    joinAsGuest();
    stubApi({ [API]: conference });
    const view = renderPage(<ConferencePage />);
    await flush();
    return view;
  }

  it("says so when nothing is scheduled", async () => {
    await renderAt({});

    expect(screen.getByText("Konferensiya rejalaştirilmagan")).toBeTruthy();
  });

  it("counts down and keeps the join link closed before the window opens", async () => {
    const { container } = await renderAt({ id: "c1", title: "Yig'ilish", datetime: at("12:00"), link: "https://meet.example/x" });
    const button = container.querySelector("#joinBtn")!;

    expect(button.hasAttribute("href")).toBe(false);
    expect(button.className).toContain("disabled");
    expect([...container.querySelectorAll(".cu b")].map(node => node.textContent)).toEqual(["03", "00", "00"]);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect([...container.querySelectorAll(".cu b")].map(node => node.textContent)).toEqual(["02", "59", "59"]);
  });

  it("opens the join link ten minutes before the start, through the server", async () => {
    const { container } = await renderAt({ id: "c 1", title: "Yig'ilish", datetime: at("09:10"), link: "https://meet.example/x" });

    expect(container.querySelector("#joinBtn")?.getAttribute("href")).toBe("/api/conference/join?id=c%201");
    expect(container.querySelector(".conf-live")).not.toBeNull();
    expect(container.querySelector<HTMLElement>("#joinHint")?.hidden).toBe(true);
  });

  it("goes live with the button disabled when the room is missing", async () => {
    const { container } = await renderAt({ title: "Yig'ilish", datetime: at("08:00") });

    expect(container.querySelector(".conf-live")).not.toBeNull();
    expect(container.querySelector("#joinBtn")?.hasAttribute("href")).toBe(false);
    expect(container.querySelector<HTMLElement>("#joinHint")?.hidden).toBe(false);
  });

  it("never links out to a non-web address", async () => {
    const { container } = await renderAt({ title: "Yig'ilish", datetime: at("08:00"), link: "javascript:alert(1)" });

    expect(container.querySelector("#joinBtn")?.hasAttribute("href")).toBe(false);
  });

  it("renders hostile titles as text", async () => {
    const { container } = await renderAt({ title: HOSTILE, desc: HOSTILE, datetime: at("08:00") });

    expect(screen.getByRole("heading", { level: 1, name: HOSTILE })).toBeTruthy();
    expect(container.querySelector("#confCard img")).toBeNull();
  });
});

describe("formatConferenceTime", () => {
  it("writes the month in the visitor's language", () => {
    expect(formatConferenceTime(at("09:05"), "ru")).toBe("1 января 2030, 09:05");
  });

  it("shows a dash for a value that is not a date", () => {
    expect(formatConferenceTime("soon", "uz")).toBe("—");
    expect(formatConferenceTime(undefined, "uz")).toBe("—");
  });
});
