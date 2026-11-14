/* TEST HELPERS shared by the assistant page tests: the stubbed API, the
   sign-in and demo steps, and what the page put on the wire. */
import { act, fireEvent } from "@testing-library/react";
import { stubCabinetApi } from "../../shell/cabinet/testApi";
import type { ApiCall, ApiRoute } from "../../shell/cabinet/testApi";
import { renderPage } from "../../test/renderPage";
import { AssistantPage } from "./AssistantPage";

export const PING = "/api/ping";
export const USAGE = "/api/ai-usage";
export const ASK = "/api/ask";
export const CHAT = "/api/chat";
export const SESSIONS = "/api/sessions";
export const FREE = { privileged: false, max: 3, used: 1, remaining: 2 };
export const UNLIMITED = { privileged: true, max: null };
export const LOGIN_ERROR = "Login yoki parol notöğri";

export async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  });
}

export async function renderAssistant(routes: Record<string, ApiRoute> = {}) {
  const calls = stubCabinetApi({ [PING]: { ai: true }, ...routes });
  const view = renderPage(<AssistantPage />);
  await flush();
  return { ...view, calls };
}

export function fill(container: HTMLElement, selector: string, value: string): void {
  fireEvent.change(container.querySelector(selector)!, { target: { value } });
}

export async function signIn(container: HTMLElement, login: string, password: string): Promise<void> {
  fill(container, "#loginInput", login);
  fill(container, "#passInput", password);
  fireEvent.submit(container.querySelector("#emailForm")!);
  await flush();
}

export async function enterDemo(routes: Record<string, ApiRoute> = {}) {
  const view = await renderAssistant({ [USAGE]: FREE, ...routes });
  fill(view.container, "#demoEmailInput", " Ali@Gmail.com ");
  fireEvent.click(view.container.querySelector("#demoBtn")!);
  await flush();
  return view;
}

export async function askQuestion(container: HTMLElement, text: string): Promise<void> {
  container.querySelector<HTMLInputElement>("#chatText")!.value = text;
  fireEvent.submit(container.querySelector("#chatForm")!);
  await flush();
}

export const isHidden = (container: HTMLElement, selector: string): boolean =>
  container.querySelector<HTMLElement>(selector)!.hidden === true;

/* The answer helper takes objects; a list has to be handed over by a function. */
export const list = (items: readonly unknown[]) => () => items;

/* What the assistant itself asked for: the footer reads the legal settings on every page. */
export const requested = (calls: readonly ApiCall[]): string[] =>
  calls.map(call => call.url).filter(url => url !== "/api/legal");

export const statusOf = (container: HTMLElement): string | null | undefined => container.querySelector("#chatStatus")?.textContent;

/* Everything the page put on the wire or kept in the browser. */
export function everythingSent(calls: readonly ApiCall[]): string {
  const stored = [localStorage, sessionStorage].flatMap(area => Object.entries(area).flat());
  return JSON.stringify([calls, stored]);
}
