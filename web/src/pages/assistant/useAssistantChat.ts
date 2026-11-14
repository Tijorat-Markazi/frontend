import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../shell/i18n";
import { ask, chat, fetchSession, fetchSessions, fetchUsage } from "./assistantApi";
import type { AssistantReply, LimitMeta, ReplyFile, SessionMeta } from "./assistantApi";
import type { PendingAttachment } from "./readAttachment";
import { mergeFiles, splitFiles } from "./replyFiles";

/**
 * Who the page is talking to, as the cookie session describes them. An
 * account's chats are kept by the server; a guest's exist only on screen.
 * Neither is sent with a request: the server reads both from the cookie.
 */
export type Visitor =
  | { kind: "account"; id: string; label: string; home: string }
  | { kind: "guest"; demoEmail: string };

export interface Backend {
  hasBackend: boolean;
  isAiOn: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  files?: readonly ReplyFile[];
}

export interface Conversation {
  id: string;
  messages: readonly ChatMessage[];
}

export interface AssistantChat {
  sessions: readonly SessionMeta[];
  current: Conversation | null;
  limit: LimitMeta | null;
  isBusy: boolean;
  /** Why the last question or the chat list failed; shown under the chat title. */
  problem: string | null;
  pending: PendingAttachment | null;
  setPending: (attachment: PendingAttachment | null) => void;
  newChat: () => void;
  openSession: (id: string) => void;
  send: (text: string) => void;
  /** Calls off the answer that is on its way. */
  stop: () => void;
}

/* The legacy page says this, in English only, when a failure carries no reason. */
const UNAVAILABLE = "Service unavailable. Please try again.";
const DEFAULT_FREE_QUESTIONS = 3;

export interface LimitView {
  isShown: boolean;
  isOver: boolean;
  remaining: number;
  max: number;
}

/** Privileged accounts have no allowance at all, so nothing is shown for them. */
export function limitView(limit: LimitMeta | null): LimitView {
  if (!limit || limit.isPrivileged || limit.max === null) return { isShown: false, isOver: false, remaining: 0, max: 0 };
  const remaining = limit.remaining ?? Math.max(0, (limit.max || DEFAULT_FREE_QUESTIONS) - limit.used);
  return { isShown: true, isOver: limit.isLimit || remaining <= 0, remaining, max: limit.max };
}

const freshConversation = (): Conversation => ({ id: `sess_${Date.now()}`, messages: [] });

/* A DOMException in the browser, so the name is what identifies it. */
const isAbort = (error: unknown): boolean => (error as { name?: unknown } | null)?.name === "AbortError";

const reason = (error: unknown): string => (error instanceof Error && error.message) || UNAVAILABLE;

function answerMessage(answer: AssistantReply): ChatMessage {
  const files = mergeFiles(answer.files, splitFiles(answer.reply).files);
  return { role: "assistant", text: answer.reply, files: files.length ? files : undefined };
}

/** One visitor's conversation with the assistant. */
export function useAssistantChat(visitor: Visitor, backend: Backend): AssistantChat {
  const { lang } = useI18n();
  const [sessions, setSessions] = useState<readonly SessionMeta[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [limit, setLimit] = useState<LimitMeta | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const isAlive = useRef(true);
  const currentRef = useRef<Conversation | null>(null);
  const { hasBackend } = backend;
  const isGuest = visitor.kind === "guest";

  const show = useCallback((conversation: Conversation) => {
    currentRef.current = conversation;
    setCurrent(conversation);
  }, []);

  const append = (id: string, message: ChatMessage) => {
    const conversation = currentRef.current;
    /* The visitor may have opened another chat while the answer was on its way. */
    if (conversation?.id === id) show({ id, messages: [...conversation.messages, message] });
  };

  const newChat = useCallback(() => show(freshConversation()), [show]);

  /* A chat that cannot be read leaves the one on screen where it is. */
  const openSession = useCallback(
    async (id: string) => {
      try {
        const messages = await fetchSession(id);
        if (isAlive.current) show({ id, messages });
      } catch (error) {
        if (isAlive.current) setProblem(reason(error));
      }
    },
    [show],
  );

  const refreshSessions = useCallback(async (): Promise<readonly SessionMeta[]> => {
    try {
      const list = await fetchSessions();
      if (isAlive.current) setSessions(list);
      return list;
    } catch (error) {
      if (isAlive.current) setProblem(reason(error));
      return [];
    }
  }, []);

  useEffect(() => {
    isAlive.current = true;
    /* Per run: the shared ref is set true again by a second mount before the
       first run's requests come back, and would let both runs open a chat. */
    let isCurrent = true;
    const refreshLimit = async () => {
      const usage = hasBackend ? await fetchUsage() : null;
      if (isAlive.current) setLimit(usage);
    };
    const start = async () => {
      if (isGuest) {
        newChat();
        await refreshLimit();
        return;
      }
      await refreshLimit();
      if (!isCurrent) return;
      const list = await refreshSessions();
      if (!isCurrent) return;
      if (list.length > 0) await openSession(list[0].id);
      else newChat();
    };
    void start();
    return () => {
      isCurrent = false;
      isAlive.current = false;
      controllerRef.current?.abort();
    };
  }, [hasBackend, isGuest, newChat, openSession, refreshSessions]);

  const request = (conversation: Conversation, text: string, attachment: PendingAttachment | null, signal: AbortSignal) => {
    if (!isGuest) return chat({ id: conversation.id, message: text, lang, attachment }, signal);
    const history = conversation.messages.map(({ role, text: said, files }) => ({ role, text: said, files }));
    return ask({ message: text, history, lang, attachment }, signal);
  };

  const send = async (text: string) => {
    const attachment = pending;
    if ((!text && !attachment) || isBusy || limitView(limit).isOver) return;
    const conversation = currentRef.current ?? freshConversation();
    const shown = `${text}${attachment ? `  📎 ${attachment.name}` : ""}`.trim();
    show({ id: conversation.id, messages: [...conversation.messages, { role: "user", text: shown }] });
    setPending(null);
    setProblem(null);

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsBusy(true);
    let answer: AssistantReply;
    try {
      answer = await request(conversation, text, attachment, controller.signal);
    } catch (error) {
      if (!isAlive.current) return;
      setIsBusy(false);
      /* Stopped by the visitor: their message stays, the answer is dropped.
         Anything else is reported as it is; no answer is invented. */
      if (!isAbort(error)) setProblem(reason(error));
      return;
    }
    if (!isAlive.current) return;
    setIsBusy(false);
    append(conversation.id, answerMessage(answer));
    if (answer.limit) setLimit(answer.limit);
    if (!isGuest && !answer.isLimit) void refreshSessions();
  };

  return {
    sessions,
    current,
    limit,
    isBusy,
    problem,
    pending,
    setPending,
    newChat,
    openSession: id => void openSession(id),
    send: text => void send(text),
    stop: () => controllerRef.current?.abort(),
  };
}
