/*
 * The four lists of the capital market (backend srv/moliya-capital.js),
 * narrowed from `unknown`. One CapitalRow union lets a single grid hold any
 * of them; `kind` tells them apart.
 */
import { amount, flag, parseMatchScore, record, text, texts } from "../../shell/market";
import type { MatchScore } from "../../shell/market";

export type CapitalSegment = "projects" | "startups" | "investors" | "ideas";

export const CAPITAL_PATHS: Readonly<Record<CapitalSegment, string>> = {
  projects: "/api/moliya/projects",
  startups: "/api/moliya/startups",
  investors: "/api/moliya/investors",
  ideas: "/api/moliya/ideas",
};

export type Project = {
  kind: "projects";
  id: string;
  name: string;
  gate: string;
  sector: string;
  summary: string;
  currency: string;
  risks: string;
  capex: number;
  opex: number;
  revenue: number;
  irr: number;
  npv: number;
  dscr: number;
  ask: number;
  jobs: number;
  readiness: number;
};

export function parseProject(value: unknown): Project {
  const item = record(value);
  return {
    kind: "projects",
    id: text(item.id),
    name: text(item.name),
    gate: text(item.gate),
    sector: text(item.sector),
    summary: text(item.summary),
    currency: text(item.currency),
    risks: text(item.risks),
    capex: amount(item.capex),
    opex: amount(item.opex),
    revenue: amount(item.revenue),
    irr: amount(item.irr),
    npv: amount(item.npv),
    dscr: amount(item.dscr),
    ask: amount(item.ask),
    jobs: amount(item.jobs),
    readiness: amount(item.readiness),
  };
}

export type Startup = {
  kind: "startups";
  id: string;
  name: string;
  stage: string;
  sector: string;
  pitch: string;
  currency: string;
  mrr: number;
  users: number;
  growth: number;
  runway: number;
  ask: number;
  valuation: number;
  founders: string[];
};

export function parseStartup(value: unknown): Startup {
  const item = record(value);
  return {
    kind: "startups",
    id: text(item.id),
    name: text(item.name),
    stage: text(item.stage),
    sector: text(item.sector),
    pitch: text(item.pitch),
    currency: text(item.currency),
    mrr: amount(item.mrr),
    users: amount(item.users),
    growth: amount(item.growth),
    runway: amount(item.runway),
    ask: amount(item.ask),
    valuation: amount(item.valuation),
    founders: texts(item.founders),
  };
}

export type Investor = {
  kind: "investors";
  id: string;
  name: string;
  type: string;
  thesis: string;
  currency: string;
  ticketMin: number;
  ticketMax: number;
  isVerified: boolean;
  sectors: string[];
  stages: string[];
};

export function parseInvestor(value: unknown): Investor {
  const item = record(value);
  return {
    kind: "investors",
    id: text(item.id),
    name: text(item.name),
    type: text(item.type),
    thesis: text(item.thesis),
    currency: text(item.currency),
    ticketMin: amount(item.ticketMin),
    ticketMax: amount(item.ticketMax),
    isVerified: flag(item.verified),
    sectors: texts(item.sectors),
    stages: texts(item.stages),
  };
}

/** The public half of an idea. The confidential half arrives only after an NDA. */
export type Idea = {
  kind: "ideas";
  id: string;
  title: string;
  teaser: string;
  model: string;
  sector: string;
  author: string;
  ipStatus: string;
  currency: string;
  price: number;
  ndaCount: number;
};

export function parseIdea(value: unknown): Idea {
  const item = record(value);
  return {
    kind: "ideas",
    id: text(item.id),
    title: text(item.title),
    teaser: text(item.teaser),
    model: text(item.model),
    sector: text(item.sector),
    author: text(item.author),
    ipStatus: text(item.ipStatus),
    currency: text(item.currency),
    price: amount(item.price),
    ndaCount: amount(item.ndaCount),
  };
}

export type CapitalRow = Project | Startup | Investor | Idea;

export const CAPITAL_PARSERS: Readonly<Record<CapitalSegment, (value: unknown) => CapitalRow>> = {
  projects: parseProject,
  startups: parseStartup,
  investors: parseInvestor,
  ideas: parseIdea,
};

/** An investor the server matched to a project or a startup. */
export type InvestorMatch = MatchScore & { investorName: string; investorType: string };

export function parseInvestorMatch(value: unknown): InvestorMatch {
  const investor = record(record(value).investor);
  return { ...parseMatchScore(value), investorName: text(investor.name), investorType: text(investor.type) };
}

/** What POST /api/moliya/idea { op: "open" } answers for one visitor. */
export type OpenedIdea = {
  ok: boolean;
  error: string;
  idea: Idea;
  isNdaSigned: boolean;
  confidential: string;
  terms: string;
  notice: string;
};

export function parseOpenedIdea(value: unknown): OpenedIdea {
  const answer = record(value);
  return {
    ok: flag(answer.ok),
    error: text(answer.error),
    idea: parseIdea(answer.idea),
    isNdaSigned: flag(answer.ndaSigned),
    confidential: text(answer.confidential),
    terms: text(answer.terms),
    notice: text(answer.notice),
  };
}
