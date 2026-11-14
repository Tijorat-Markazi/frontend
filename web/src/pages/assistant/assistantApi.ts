import { asArray, asNumber, asString, isRecord } from "../../shell/chat";
import { auth } from "../../shell/session";
import type { PendingAttachment } from "./readAttachment";

/* Every call here goes through the cookie session. The server works out whose
   chats and whose free questions these are from that cookie alone, so no
   request names an account, a guest or a company. */

export interface ReplyFile {
  /** Already checked: a path under /uploads/ on this site. */
  url: string;
  name: string;
  size?: number;
}

/** The free-question allowance, as /api/ai-usage and each answer report it. */
export interface LimitMeta {
  isPrivileged: boolean;
  max: number | null;
  remaining: number | null;
  used: number;
  isLimit: boolean;
}

export interface AssistantReply {
  reply: string;
  files: ReplyFile[];
  /** Present only when the answer carried an allowance. */
  limit: LimitMeta | null;
  /** The question was refused because the allowance is spent. */
  isLimit: boolean;
}

export interface SessionMeta {
  id: string;
  title: string;
  updated: number;
}

export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
}

const UPLOADS = "/uploads/";
const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } } as const;

/** Generated documents live under /uploads/ on this site; anything else is not a download. */
export function uploadUrl(value: unknown): string {
  const url = auth.safeUrl(asString(value));
  return url.startsWith(UPLOADS) ? url : "";
}

function parseFile(value: unknown): ReplyFile | null {
  if (!isRecord(value)) return null;
  const url = uploadUrl(value.url);
  if (!url) return null;
  return { url, name: asString(value.name), size: asNumber(value.size) || undefined };
}

function parseLimit(data: Record<string, unknown>): LimitMeta {
  return {
    isPrivileged: Boolean(data.privileged),
    max: data.max == null ? null : asNumber(data.max),
    remaining: data.remaining == null ? null : asNumber(data.remaining),
    used: asNumber(data.used),
    isLimit: Boolean(data.limit),
  };
}

/* An answer without a reply is a failure: nothing is made up in its place. */
function parseReply(data: unknown): AssistantReply {
  if (!isRecord(data) || typeof data.reply !== "string") throw new Error("");
  return {
    reply: data.reply,
    files: asArray(data.files).flatMap(item => parseFile(item) ?? []),
    limit: data.max == null ? null : parseLimit(data),
    isLimit: Boolean(data.limit),
  };
}

function parseSession(value: unknown): SessionMeta | null {
  if (!isRecord(value) || !asString(value.id)) return null;
  return { id: asString(value.id), title: asString(value.title), updated: asNumber(value.updated) };
}

function parseStoredMessage(value: unknown): StoredMessage | null {
  if (!isRecord(value)) return null;
  return { role: value.role === "user" ? "user" : "assistant", text: asString(value.text) };
}

/** Rejects when the session or the server cannot be reached. */
export async function ping(): Promise<{ isAiOn: boolean }> {
  await auth.ready();
  const data = await auth.json("/api/ping");
  return { isAiOn: isRecord(data) && Boolean(data.ai) };
}

/** The signed-in account's stored chats, newest first. Rejects with the server's reason. */
export async function fetchSessions(): Promise<SessionMeta[]> {
  return asArray(await auth.json("/api/sessions")).flatMap(item => parseSession(item) ?? []);
}

export async function fetchSession(id: string): Promise<StoredMessage[]> {
  const data = await auth.json(`/api/session?id=${encodeURIComponent(id)}`);
  return isRecord(data) ? asArray(data.messages).flatMap(item => parseStoredMessage(item) ?? []) : [];
}

export interface GuestQuestion {
  message: string;
  history: readonly object[];
  lang: string;
  attachment: PendingAttachment | null;
}

/** A guest's question: nothing is stored, the conversation so far travels with it. */
export async function ask(question: GuestQuestion, signal: AbortSignal): Promise<AssistantReply> {
  return parseReply(await auth.json("/api/ask", question, { signal }));
}

export interface AccountQuestion {
  id: string;
  message: string;
  lang: string;
  attachment: PendingAttachment | null;
}

/** A signed-in account's question, filed under its own chats by the server. */
export async function chat(question: AccountQuestion, signal: AbortSignal): Promise<AssistantReply> {
  return parseReply(await auth.json("/api/chat", question, { signal }));
}

/* The two below are best effort, as on the legacy page: a failure reads as
   "nothing to show" and the question itself reports any real problem. */

export async function fetchUsage(): Promise<LimitMeta | null> {
  try {
    const response = await auth.fetch("/api/ai-usage", { ...JSON_POST, body: "{}" });
    const data: unknown = response.ok ? await response.json() : null;
    return isRecord(data) ? parseLimit(data) : null;
  } catch {
    return null;
  }
}

export async function transcribe(audio: string, mime: string): Promise<string> {
  try {
    const response = await auth.fetch("/api/transcribe", { ...JSON_POST, body: JSON.stringify({ audio, mime }) });
    const data: unknown = response.ok ? await response.json() : null;
    return isRecord(data) ? asString(data.text) : "";
  } catch {
    return "";
  }
}
