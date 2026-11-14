import { LANGS, T } from "@legacy/data.js";
import type { Lang, Localized } from "@legacy/data.js";
import { useI18n } from "../i18n";
import { dialogs } from "../dialogs";
import { goTo } from "../navigate";
import { auth } from "../session";
import { record, text } from "./narrow";
import type { Json } from "./narrow";

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

/* ------------------------------------------------------------------
   The rest of market-kit.js. What the kit offers, by legacy name:

     MK.t / setDict   useMarketText(dictionary)
     MK.num           formatNumber        MK.money     formatMoney
     MK.pctTxt        formatPercent       MK.day       formatDay
     MK.safeUrl       safeHttpUrl         MK.qs        queryString / marketQuery
     MK.api           marketJson (answers as an un-narrowed record)
     MK.ident         identity (the person: .email, .name, .setPerson) and
                      companyIdentity (.company, .withCompany = co,
                      .withPerson = me)
     MK.companyLogin  companyLogin; loadCompany for a session already open;
                      companyLogout for the "sign out" of a company strip
     MK.esc / escA    not needed: JSX escapes text and attributes
     MK.chrome / applyStatic / $ / $$   replaced by PublicPage and i18n

   Identity is the cookie session's business. Nothing here keeps a login or
   a password, and no request carries one: the server reads the company from
   the session, exactly as it does for market-kit.js.

   The painters (chip, match, ranks, drawer …) are the components beside
   this file; index.ts lists them all.
   ------------------------------------------------------------------ */

const MONEY_UNITS: Record<Lang, readonly [string, string]> = {
  uz: ["mln", "mlrd"],
  ru: ["млн", "млрд"],
  en: ["M", "B"],
};
const MILLION = 1e6;
const BILLION = 1e9;

/** Big sums stay readable: 3 200 000 000 UZS becomes "3.2 mlrd UZS". Zero reads as "—". */
export function formatMoney(value: unknown, currency: string, lang: Lang): string {
  const number = Number(value);
  if (!Number.isFinite(number) || !number) return "—";
  const suffix = currency ? ` ${currency}` : "";
  const [million, billion] = MONEY_UNITS[lang];
  if (Math.abs(number) >= BILLION) return `${formatNumber(number / BILLION, lang, 2)} ${billion}${suffix}`;
  if (Math.abs(number) >= MILLION) return `${formatNumber(number / MILLION, lang, 2)} ${million}${suffix}`;
  return formatNumber(number, lang) + suffix;
}

export const formatPercent = (value: unknown, lang: Lang): string =>
  Number.isFinite(Number(value)) ? `${formatNumber(value, lang, 0)}%` : "—";

type QueryValue = string | number | boolean | null | undefined;

/** As queryString, and also drops null, undefined and false, the way MK.qs does. */
export function marketQuery(params: Record<string, QueryValue>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== "" && value != null && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

/** Never rejects: failures come back as `{ error: "network" | "bad_response" }`. */
export async function marketJson(path: string, body?: object): Promise<Json> {
  try {
    const options = body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : undefined;
    const response = await auth.fetch(path, options);
    try {
      return record(await response.json());
    } catch {
      return { error: "bad_response" };
    }
  } catch {
    return { error: "network" };
  }
}

/** The signed-in company as the pages show it. Holds no credential. */
export type CompanySession = { id: string; name: string; sector: string };

/* The session names the company but not its sector; /api/company/login does.
   Kept per company id, so a different account never inherits it. */
let knownCompany: CompanySession | null = null;

function sessionCompany(): CompanySession | null {
  const user = auth.user(["company"]);
  if (!user) return null;
  const id = text(user.id);
  return knownCompany?.id === id ? knownCompany : { id, name: text(user.name), sector: "" };
}

export const companyIdentity = {
  /** The company behind the current session, or null (MK.ident.company). */
  company: sessionCompany,
  /**
   * The body of a request that needs a company (MK.ident.co). The server
   * reads the company from the cookie, so this adds nothing; it marks the
   * calls that only a signed-in company may make.
   */
  withCompany<T extends object>(extra: T): T {
    return { ...extra };
  },
  /** Identity to attach to a request that accepts a person (MK.ident.me). */
  withPerson<T extends object>(extra: T): T & { email: string; name: string } {
    return { ...extra, email: identity.email(), name: identity.name() };
  },
};

/**
 * The company of the session that is already open, read from the server
 * (POST /api/company/login with an empty body). Null for anyone else.
 */
export async function loadCompany(): Promise<CompanySession | null> {
  try {
    await auth.ready();
  } catch {
    return null;
  }
  if (!auth.user(["company"])) return null;
  const answer = await marketJson("/api/company/login", {});
  const company = record(answer.company);
  if (!text(company.id)) return null;
  knownCompany = { id: text(company.id), name: text(company.name), sector: text(company.sector) };
  return knownCompany;
}

/**
 * Signs in with the pair company.html issues. Resolves to the company, or
 * null when the pair is refused. A pair that belongs to another kind of
 * account opens that account's session, so the visitor is sent to its page.
 */
export async function companyLogin(login: string, password: string): Promise<CompanySession | null> {
  let session;
  try {
    session = await auth.login(login, password);
  } catch {
    return null;
  }
  if (session.role !== "company") {
    goTo(auth.safeTarget(session.target) ?? "index.html");
    return null;
  }
  return loadCompany();
}

/** Ends the session. Resolves to false when the server could not be reached. */
export async function companyLogout(): Promise<boolean> {
  try {
    await auth.logout();
    knownCompany = null;
    return true;
  } catch {
    return false;
  }
}
