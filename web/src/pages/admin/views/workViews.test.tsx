import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dialogs } from "../../../shell/dialogs";
import { HOSTILE } from "../../../test/renderPage";
import { button, orgsFixture, renderView, stubRoutes, type, uz } from "../testKit";
import type { Sent } from "../testKit";

const QUESTIONS = "/api/rais/questions";
const LETTER = "/api/rais/assoc-letter";
const questions = {
  ym: "2026-05",
  months: ["2026-05", "2026-04"],
  assocs: [{ id: "a1", name: "Toʻqimachilar", count: 3, companies: 2, questions: [{ question: "Bojxona?", count: 2, companies: ["Alfa"] }] }],
  report: [{ question: HOSTILE, count: 1, askers: ["user@x.uz"] }],
};

describe("questions view", () => {
  it("shows the month's questions per association and overall", async () => {
    const api = stubRoutes({ [QUESTIONS]: questions });
    renderView("questions");

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(screen.getByText("user@x.uz")).toBeTruthy();
    expect(screen.getByText(uz("q_repeat"))).toBeTruthy();
    expect(api.bodies(QUESTIONS)[0]).toEqual({});
    expect(document.querySelector("img")).toBeNull();
  });

  it("loads the month chosen in the picker", async () => {
    const api = stubRoutes({ [QUESTIONS]: questions });
    renderView("questions");
    await screen.findByText(HOSTILE);

    type(screen.getByLabelText(uz("rep_month")), "2026-04");

    await waitFor(() => expect(api.bodies(QUESTIONS).at(-1)).toEqual({ ym: "2026-04" }));
  });

  it("opens the combined official letter as text and closes it again", async () => {
    const api = stubRoutes({
      [QUESTIONS]: questions,
      [LETTER]: { ok: true, letter: { recipientLabel: "Soliq qoʻmitasi", recipientType: "company", body: `Hurmatli ${HOSTILE}` } },
    });
    renderView("questions");
    await screen.findByText(HOSTILE);

    fireEvent.click(button(uz("q_assoc_letter")));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(`Hurmatli ${HOSTILE}`);
    expect(dialog.querySelector("img")).toBeNull();
    expect(api.bodies(LETTER)).toEqual([{ assocId: "a1", ym: "2026-05", lang: "uz" }]);

    fireEvent.click(button("✕"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says there is nothing to write when the letter cannot be made", async () => {
    const alert = vi.spyOn(dialogs, "alert").mockResolvedValue(undefined);
    stubRoutes({ [QUESTIONS]: questions, [LETTER]: { ok: false } });
    renderView("questions");
    await screen.findByText(HOSTILE);

    fireEvent.click(button(uz("q_assoc_letter")));

    await waitFor(() => expect(alert).toHaveBeenCalledWith(uz("q_empty")));
  });
});

const CHATS = "/api/admin/chats";

describe("projects and project chat", () => {
  it("lists every company's projects", async () => {
    stubRoutes({ "/api/admin/projects": { projects: [{ company: "Alfa", title: HOSTILE, amount: "$1M" }] } });
    renderView("projects");

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(screen.getByText("$1M")).toBeTruthy();
  });

  it("shows the empty note when no project exists", async () => {
    stubRoutes({ "/api/admin/projects": { projects: [] } });
    renderView("projects");

    expect(await screen.findByText(uz("pr_empty"))).toBeTruthy();
  });

  it("opens a company's thread and sends a reply", async () => {
    const thread = [{ from: "company", text: HOSTILE }];
    const api = stubRoutes({
      [CHATS]: (body: Sent) => {
        if (body.op === "thread") return { messages: thread };
        if (body.op === "send") return { messages: [...thread, { from: "admin", text: body.text }] };
        return { chats: [{ companyId: "c1", name: "Alfa", last: "Salom", lastFrom: "company", count: 1 }] };
      },
    });
    renderView("chat");

    fireEvent.click(await screen.findByRole("button", { name: /Alfa/ }));
    expect(await screen.findByText(HOSTILE)).toBeTruthy();

    type(screen.getByPlaceholderText(uz("ch_ph")), "  Javob  ");
    fireEvent.click(button(uz("ch_send")));

    expect(await screen.findByText("Javob")).toBeTruthy();
    expect(api.bodies(CHATS).at(-1)).toEqual({ op: "send", companyId: "c1", text: "Javob" });
  });
});

describe("project chat bubbles and the rais", () => {
  it("styles a message as the company or the admin and never from the text the server sent", async () => {
    stubRoutes({
      [CHATS]: (body: Sent) =>
        body.op === "thread"
          ? { messages: [{ from: "company", text: "Savol" }, { from: 'x" onmouseover="alert(1)', text: "Javob" }] }
          : { chats: [{ companyId: "c1", name: "Alfa", last: "Oxirgi", lastFrom: "company", count: 2 }] },
    });
    renderView("chat");

    fireEvent.click(await screen.findByRole("button", { name: /Alfa/ }));

    expect((await screen.findByText("Savol")).parentElement?.className).toBe("pchat-msg company");
    expect(screen.getByText("Javob").parentElement?.className).toBe("pchat-msg admin");
  });

  it("sends a rais who lands on a view that is not theirs back to the dashboard", async () => {
    const api = stubRoutes({ "/api/orgs": orgsFixture(), "/api/google/status": { available: true } });
    renderView("settings", "rais");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(uz("nav_dash"));
    await waitFor(() => expect(api.bodies("/api/orgs")).toEqual([{ op: "list" }]));
    expect(api.calls.map(call => call.url)).not.toContain("/api/google/status");
  });
});

const CONFERENCE = "/api/conference";
const LIST_GLOBAL = "/api/conference?manage=1&assoc=";
const meeting = { id: "m1", title: "Kengash", datetime: "2026-07-01T10:00", link: "https://meet.example/abc", provider: "meet-bot" };

describe("conference view", () => {
  it("lists the meetings and never links to an unsafe address", async () => {
    stubRoutes({
      "/api/orgs": orgsFixture(),
      [LIST_GLOBAL]: { meetings: [meeting, { id: "m2", title: HOSTILE, datetime: "x", link: "javascript:alert(1)" }] },
    });
    renderView("conference");

    expect(await screen.findByText(HOSTILE)).toBeTruthy();
    expect(screen.getByRole("link", { name: meeting.link }).getAttribute("href")).toBe(meeting.link);
    /* admin.js prints KGAuth.safeUrl(link): a rejected address is not shown at all. */
    expect(screen.queryByText("javascript:alert(1)")).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getAllByRole("link", { name: uz("conf_join") })[0].getAttribute("href")).toBe("/api/conference/join?id=m1");
  });

  it("schedules a meeting for everyone and reports the automatic room", async () => {
    const api = stubRoutes({ [LIST_GLOBAL]: { meetings: [] }, [CONFERENCE]: { meetings: [meeting], meeting } });
    renderView("conference");
    await screen.findByText(uz("conf_none_list"));

    type(screen.getByLabelText(uz("conf_title")), " Kengash ");
    type(screen.getByLabelText(uz("conf_dt")), "2026-07-01T10:00");
    fireEvent.click(button(uz("conf_add")));

    expect(await screen.findByText(uz("conf_meet_ready"))).toBeTruthy();
    expect(api.bodies(CONFERENCE)).toEqual([
      { assocId: "", title: "Kengash", datetime: "2026-07-01T10:00", link: "", desc: "" },
    ]);
    expect(screen.getByText("Kengash")).toBeTruthy();
  });

  it("refuses a link that is not http or https before contacting the server", async () => {
    const api = stubRoutes({ [LIST_GLOBAL]: { meetings: [] } });
    renderView("conference");
    await screen.findByText(uz("conf_none_list"));

    type(screen.getByLabelText(uz("conf_title")), "Kengash");
    type(screen.getByLabelText(uz("conf_dt")), "2026-07-01T10:00");
    type(screen.getByLabelText(uz("conf_link")), "ftp://x");
    fireEvent.submit(screen.getByLabelText(uz("conf_title")).closest("form") as HTMLFormElement);

    expect(await screen.findByText(uz("conf_link_err"))).toBeTruthy();
    expect(api.bodies(CONFERENCE)).toEqual([]);
  });

  it("removes a meeting from the chosen association's list", async () => {
    const api = stubRoutes({
      "/api/orgs": orgsFixture(),
      [LIST_GLOBAL]: { meetings: [] },
      "/api/conference?manage=1&assoc=a1": { meetings: [meeting] },
      [CONFERENCE]: { meetings: [] },
    });
    renderView("conference");
    await screen.findByRole("option", { name: "Toʻqimachilar" });

    type(screen.getByLabelText(uz("conf_target")), "a1");
    await screen.findByText("Kengash");
    fireEvent.click(button(uz("del")));

    await waitFor(() => expect(api.bodies(CONFERENCE)).toEqual([{ assocId: "a1", removeId: "m1" }]));
    expect(await screen.findByText(uz("conf_none_list"))).toBeTruthy();
  });
});

describe("settings view", () => {
  it("has no operator requisites form, as the production panel has none", async () => {
    const api = stubRoutes({ "/api/google/status": { available: true, signedIn: true, email: HOSTILE } });
    renderView("settings");

    expect(await screen.findByText(new RegExp(uz("g_on")))).toBeTruthy();
    expect(document.getElementById("opCard")).toBeNull();
    expect(api.calls.map(call => call.url)).toEqual(["/api/google/status"]);
    expect(document.querySelector("img")).toBeNull();
  });

  it("keeps the note that the demo lists live in this browser", () => {
    stubRoutes({ "/api/google/status": { available: false } });
    renderView("settings");

    expect(screen.getByText(uz("set_note"))).toBeTruthy();
  });

  it("starts the Google sign-in on the server and explains what to do next", async () => {
    const api = stubRoutes({ "/api/google/status": { available: true, signedIn: false }, "/api/google/login": {} });
    renderView("settings");

    fireEvent.click(await screen.findByRole("button", { name: uz("g_login") }));

    expect(await screen.findByText(uz("g_opening"))).toBeTruthy();
    expect(api.bodies("/api/google/login")).toEqual([{}]);
  });
});
