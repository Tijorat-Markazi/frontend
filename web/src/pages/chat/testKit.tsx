/* TEST HELPERS shared by the group chat tests: the stubbed /api/group, a
   signed-in company, and the socket the test plays the server on. */
import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { signInAs } from "../../shell/cabinet/testApi";
import { stubSocket } from "../../test/fakeSocket";
import { renderPage } from "../../test/renderPage";
import { ChatPage } from "./ChatPage";

export const ROOM = "assoc:a1";
export const ME = { type: "company", id: "c1", name: "Acme" };
export const ROOMS = [
  {
    id: ROOM,
    title: "Paxta uyushmasi",
    count: 1,
    last: "",
    lastFrom: "",
    time: 0,
    members: [
      { id: "c1", role: "company", name: "Acme" },
      { id: "a1", role: "assoc", name: "Karim" },
      { id: "rais", role: "rais", name: "Rais", observer: true },
    ],
  },
];
export const message = (id: string, text: string, extra: object = {}) => ({
  id,
  from: "assoc",
  fromId: "a1",
  fromName: "Karim",
  text,
  time: Date.now(),
  ...extra,
});

export type Body = Record<string, unknown>;
export type Handler = (body: Body) => unknown;

/** Answers /api/group by operation; a missing answer is a refused request. */
export function stubGroupApi(handlers: Record<string, Handler | undefined>): Body[] {
  const calls: Body[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      if (url !== "/api/group") return { ok: true, status: 200, json: async () => ({}) };
      const body = JSON.parse(init?.body ?? "{}") as Body;
      calls.push(body);
      const handler = handlers[String(body.op)];
      if (!handler) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => handler(body) };
    }),
  );
  return calls;
}

export const listed: Handler = () => ({ ok: true, me: ME, groups: ROOMS });
export const threadOf = (...messages: object[]): Handler => () => ({ ok: true, me: ME, messages });

export const signInAsCompany = (): void => signInAs("company", { id: "c1", login: "acme", name: "Acme" });

/* Everything the page put on the wire or kept in the browser. */
export const everythingSent = (calls: readonly Body[], frames: readonly Body[]): string =>
  JSON.stringify([calls, frames, vi.mocked(fetch).mock.calls.map(([url]) => url), { ...localStorage }, { ...sessionStorage }]);

export async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
}

export async function openChat(handlers: Record<string, Handler | undefined>) {
  signInAsCompany();
  const latest = stubSocket();
  const calls = stubGroupApi(handlers);
  const view = renderPage(<ChatPage />);
  await flush();
  return { ...view, calls, latest };
}

export async function connect(latest: ReturnType<typeof stubSocket>) {
  const socket = latest();
  await act(async () => {
    socket.open();
    socket.receive({ op: "auth", ok: true });
  });
  return socket;
}

export function type(container: HTMLElement, text: string): void {
  const input = container.querySelector<HTMLInputElement>("#tgInput")!;
  input.value = text;
  fireEvent.submit(container.querySelector("#tgForm")!);
}
