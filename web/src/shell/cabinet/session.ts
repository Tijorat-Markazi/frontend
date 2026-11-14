/**
 * CABINET API — how a cabinet talks to the server.
 *
 * Who is signed in is the server's business: one HttpOnly cookie carries the
 * session, so a cabinet keeps no login or password and sends none. Every call
 * goes through the shared session (shell/session), which adds the CSRF header
 * a write needs.
 *
 *   cabinetPost(path, body?)   POST JSON. Never rejects: answers
 *                              { isOk, status, body }, where body is the parsed
 *                              object ({} when unreadable) and isOk is the HTTP
 *                              verdict. status 0 means the server could not be
 *                              reached. 401 means the session has ended.
 *   cabinetGet(path)           the same answer shape for a GET
 */
import { record } from "../market/narrow";
import type { Json } from "../market/narrow";
import { auth } from "../session";

export type CabinetAnswer = { isOk: boolean; status: number; body: Json };

const UNREACHABLE: CabinetAnswer = { isOk: false, status: 0, body: {} };

async function readAnswer(send: () => Promise<Response>): Promise<CabinetAnswer> {
  try {
    const response = await send();
    const body: unknown = await response.json().catch(() => null);
    return { isOk: response.ok, status: response.status, body: record(body) };
  } catch {
    return UNREACHABLE;
  }
}

export function cabinetPost(path: string, body: object = {}): Promise<CabinetAnswer> {
  return readAnswer(() =>
    auth.fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function cabinetGet(path: string): Promise<CabinetAnswer> {
  return readAnswer(() => auth.fetch(path));
}
