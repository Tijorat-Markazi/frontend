import { auth } from "../session";

const WEB_URL = /^https?:\/\//i;
/* "/uploads/a.png", but not "//host/a.png" or a slash followed by a backslash:
   browsers read both of those as another host. */
const SAME_ORIGIN_PATH = /^\/(?![/\\])/;

/** The address a typed link may open: http or https only, or null. */
export function safeLinkHref(url: string): string | null {
  const trimmed = url.trim();
  const href = /^www\./i.test(trimmed) ? `http://${trimmed}` : trimmed;
  return WEB_URL.test(href) ? href : null;
}

/**
 * An image, audio or file address: http, https or a path on this site. Empty
 * when neither. The last word is the session's safeUrl, the one rule
 * production applies to every address the API supplies; it also writes an
 * address on this site as a path.
 */
export function safeMediaUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  return WEB_URL.test(url) || SAME_ORIGIN_PATH.test(url) ? auth.safeUrl(url) : "";
}
