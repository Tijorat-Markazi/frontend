/* Who is asking is the server's business: the cookie session of an admin or a
   rais travels with every request, so nothing here names the caller. Going
   through the shared session is also what adds the CSRF header a write needs
   (admin.js: KGAuth.fetch). */
import { auth } from "../../shell/session";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type Body = Readonly<Record<string, unknown>>;

/** POSTs a privileged request as admin.js sent it. Rejects when the network or the JSON fails. */
export async function adminPost(path: string, body: Body = {}): Promise<unknown> {
  const response = await auth.fetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return (await response.json()) as unknown;
}

/** The same request, answering { error: "network" } instead of rejecting. */
export async function adminPostSafe(path: string, body: Body = {}): Promise<unknown> {
  try {
    return await adminPost(path, body);
  } catch {
    return { error: "network" };
  }
}

export async function getJson(path: string): Promise<unknown> {
  const response = await auth.fetch(path);
  return (await response.json()) as unknown;
}
