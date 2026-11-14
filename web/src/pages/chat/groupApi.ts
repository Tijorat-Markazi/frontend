import { isRecord } from "../../shell/chat";
import { auth } from "../../shell/session";

export type GroupReply = Record<string, unknown>;

/**
 * One call to /api/group. The server works out who is asking from the cookie
 * session, so nothing here says who the caller is. Resolves to the answer only
 * when the server accepted it; a refusal, a network failure and an unreadable
 * body are all null.
 */
export async function callGroupApi(lang: string, body: object): Promise<GroupReply | null> {
  try {
    const response = await auth.fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* Room titles carry an association name, so they follow the reader's language. */
      body: JSON.stringify({ lang, ...body }),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isRecord(data) && data.ok ? data : null;
  } catch {
    return null;
  }
}
