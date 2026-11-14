/**
 * TEST HELPER for cabinet pages: answers fetch by path and records every call.
 *
 *   signInAs("assoc", { id: "a1", name: "Paxta" })              // the cookie session the
 *                                                                // page finds; target is
 *                                                                // that role's cabinet
 *   const calls = stubCabinetApi({
 *     "/api/assoc/login": { assoc: {…}, companies: [] },        // 200 with this JSON
 *     "/api/assoc/companies": body => ({ companies: […] }),     // computed from the POST body
 *     "/api/assoc/news": 500,                                   // refused, empty body
 *     "/api/x": refused(409, { error: "login exists" }),        // refused, with a body
 *   });
 *   bodiesSentTo(calls, "/api/assoc/companies")   → the parsed POST bodies, in order
 *   calls[0]                                      → { url, method, body }
 *
 * A path that is not listed answers 404. GET routes are matched with their query.
 * The session is the fake of test/fakeSession: no route has to accept a login
 * or a password, and no body should carry one. To drive the login form use
 * setLoginResult from test/fakeSession.
 */
import { vi } from "vitest";
import { setTestSession } from "../../test/fakeSession";

export type ApiBody = Record<string, unknown>;
export type ApiCall = { url: string; method: string; body: ApiBody };
type Refusal = { refusedWith: number; body: unknown };
type Answer = unknown;
/** A JSON answer, a refusal status, or a function of the POST body returning either. */
export type ApiRoute = number | Refusal | Readonly<Record<string, unknown>> | ((body: ApiBody) => Answer);

/* As the server's session view names them (backend srv/auth.js). */
const CABINETS: Readonly<Record<string, string | undefined>> = {
  admin: "admin.html",
  rais: "admin.html",
  assoc: "association.html",
  company: "company.html",
  analyst: "tahlil.html",
  buyer: "xaridor.html",
};

type TestUser = { id?: string; login?: string; name?: string; email?: string };

/** A full session of that role, as if the person had signed in before the page opened. */
export function signInAs(role: string, user: TestUser = {}): void {
  setTestSession({
    authenticated: true,
    role,
    target: CABINETS[role] ?? "assistant.html",
    user: { id: `${role}-1`, role, ...user },
  });
}

export const refused = (status: number, body: unknown = {}): Refusal => ({ refusedWith: status, body });

const isRefusal = (answer: unknown): answer is Refusal =>
  typeof answer === "object" && answer !== null && "refusedWith" in answer;

function respond(answer: Answer) {
  const refusal = typeof answer === "number" ? refused(answer) : isRefusal(answer) ? answer : null;
  if (refusal) return { ok: false, status: refusal.refusedWith, json: async () => refusal.body };
  return { ok: true, status: 200, json: async () => answer };
}

export function stubCabinetApi(routes: Record<string, ApiRoute>): ApiCall[] {
  const calls: ApiCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}") as ApiBody;
      calls.push({ url, method: init?.method ?? "GET", body });
      if (!(url in routes)) return respond(404);
      const route = routes[url];
      return respond(typeof route === "function" ? route(body) : route);
    }),
  );
  return calls;
}

export const bodiesSentTo = (calls: readonly ApiCall[], url: string): ApiBody[] =>
  calls.filter(call => call.url === url).map(call => call.body);
