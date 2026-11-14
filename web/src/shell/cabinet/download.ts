/**
 * CABINET DOWNLOAD — fetches a document the server guards and hands it to the
 * browser as a file.
 *
 *   downloadDocument(path, fallbackName, body?)
 *     path          the document's address, its own parameters in the query:
 *                   "/api/appeal/doc?id=…", "/api/assoc/report.doc?ym=2026-03"
 *     fallbackName  used when the server names no file
 *     body          makes it a JSON POST, for an endpoint that reads its
 *                   parameters from the body ("/api/analyst/export")
 *   Saves the answer under the server's file name. Resolves false when the
 *   server refuses or cannot be reached.
 *
 * The cookie session is the only proof of identity: nothing about the caller
 * rides in the address or the body. Going through the session rather than a
 * plain link is what lets the cabinet say so when the server refuses.
 */
import { auth } from "../session";

/** The file name out of a Content-Disposition header, kept to a bare name. */
function fileNameFrom(header: string | null, fallback: string): string {
  const match = /filename="?([^";]+)"?/i.exec(header ?? "");
  const name = (match?.[1] ?? "").replace(/[^\w.\- ]+/g, "").trim();
  return name || fallback;
}

function requestFor(body: object | undefined): RequestInit | undefined {
  if (!body) return undefined;
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function downloadDocument(path: string, fallbackName: string, body?: object): Promise<boolean> {
  try {
    const response = await auth.fetch(path, requestFor(body));
    if (!response.ok) return false;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFrom(response.headers.get("Content-Disposition"), fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
