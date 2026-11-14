import { asArray, asString, isRecord } from "../../../shell/chat";
import { auth } from "../../../shell/session";
import { adminPost, getJson } from "../api";
import type { Body } from "../api";

const CONFERENCE = "/api/conference";

export interface Meeting {
  id: string;
  title: string;
  datetime: string;
  desc: string;
  /** The room address as stored; it only says whether the meeting has a room. */
  link: string;
  /** The address the session module passes as safe, else null. It is the only form shown
      or linked, as admin.js prints KGAuth.safeUrl(link) for both. */
  href: string | null;
  isAutoRoom: boolean;
  meetError: string;
}

export interface ConferenceAnswer {
  isOk: boolean;
  meetings: readonly Meeting[];
  /** The meeting a save just created, when the answer names one. */
  meeting: Meeting | null;
}

function parseMeeting(value: unknown): Meeting {
  const item = isRecord(value) ? value : {};
  const link = asString(item.link);
  return {
    id: asString(item.id),
    title: asString(item.title),
    datetime: asString(item.datetime),
    desc: asString(item.desc),
    link,
    href: auth.safeUrl(link) || null,
    isAutoRoom: item.provider === "meet-bot",
    meetError: asString(item.meetError),
  };
}

function parseAnswer(value: unknown): ConferenceAnswer {
  const answer = isRecord(value) ? value : {};
  return {
    isOk: Boolean(answer.ok),
    meetings: asArray(answer.meetings).map(parseMeeting),
    meeting: isRecord(answer.meeting) ? parseMeeting(answer.meeting) : null,
  };
}

/** The meetings scheduled for one association, or for everyone when the id is empty. */
export async function loadMeetings(assocId: string): Promise<readonly Meeting[]> {
  return parseAnswer(await getJson(`${CONFERENCE}?manage=1&assoc=${encodeURIComponent(assocId)}`)).meetings;
}

/** Adds, removes or re-links a meeting; the answer carries the fresh list. */
export async function postConference(body: Body): Promise<ConferenceAnswer> {
  return parseAnswer(await adminPost(CONFERENCE, body));
}
