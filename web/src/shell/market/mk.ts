import { LANGS, T } from "@legacy/data.js";
import type { Lang, Localized } from "@legacy/data.js";
import { useI18n } from "../i18n";
import { dialogs } from "../dialogs";
import { auth } from "../session";

export type Dictionary = Readonly<Record<string, Localized | undefined>>;
export type Translate = (key: string, fallback?: string) => string;

/** Page strings first, then the shared dictionary, then the fallback or key. */
export function useMarketText(dictionary: Dictionary): Translate {
  const { lang } = useI18n();
  const index = LANGS.indexOf(lang);
  return (key, fallback) => (dictionary[key] ?? T[key])?.[index] ?? fallback ?? key;
}

const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export function formatNumber(value: unknown, lang: Lang, digits?: number): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(LOCALE[lang], {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 2,
  });
}

export function formatDay(timestamp: unknown, lang: Lang): string {
  const date = new Date(Number(timestamp) || 0);
  return Number.isFinite(date.getTime()) && timestamp ? date.toLocaleDateString(LOCALE[lang]) : "—";
}

export const safeHttpUrl = (url: string | undefined): string =>
  url && /^https?:\/\//i.test(url) ? url : "";

/** Same-origin uploads and web addresses, but not "//host/x.jpg", which loads from another server. */
export function safeImageUrl(url: string | undefined): string {
  /* Browsers read a backslash here as a slash. */
  if (!url || /^[/\\]{2}/.test(url)) return "";
  return auth.safeUrl(url, true);
}

export function queryString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

type ApiResult<T> = Partial<T> & { ok?: boolean; error?: string };

/** Never rejects: a network or parse failure comes back as `{ error }`. */
export async function marketApi<T extends object>(path: string, body?: object): Promise<ApiResult<T>> {
  try {
    const options = body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : undefined;
    const response = await auth.fetch(path, options);
    return (await response.json()) as ApiResult<T>;
  } catch {
    return { error: "network" } as ApiResult<T>;
  }
}

/* Contact details live on the server session; email is contact data, not a credential. */
let contact: { email: string; name: string } | null = null;

export const identity = {
  email(): string {
    const session = auth.current();
    return contact?.email || session?.user?.email || session?.guest?.email || "";
  },
  name(): string {
    const session = auth.current();
    return contact?.name || session?.user?.name || session?.guest?.name || "";
  },
  async setPerson(email: string, name: string): Promise<boolean> {
    try {
      const session = await auth.ready();
      if (session.role === "guest") await auth.guest(email, name);
      contact = { email, name };
      return true;
    } catch (error: unknown) {
      void dialogs.alert(error instanceof Error ? error.message : String(error));
      return false;
    }
  },
};
