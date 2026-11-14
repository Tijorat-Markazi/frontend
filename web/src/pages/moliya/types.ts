/*
 * The shapes the finance market reads from /api/moliya/*, each narrowed from
 * `unknown` by its parser. Field names are the server's (backend srv/moliya.js
 * and srv/moliya-capital.js); anything missing reads as "" / 0 / [].
 */
import { amount, flag, listOf, parseMatchScore, parseMeter, record, text, texts } from "../../shell/market";
import type { Json, MatchScore, Meter } from "../../shell/market";

export const REQUEST_CURRENCIES = ["UZS", "USD", "EUR", "RUB"] as const;
export const CAPITAL_CURRENCIES = ["USD", "UZS", "EUR"] as const;
export const PASSPORT_CURRENCIES = ["UZS", "USD", "EUR"] as const;
export const SHORT_CURRENCIES = ["USD", "UZS"] as const;
export const PRODUCT_CATEGORIES = [
  "banking",
  "nobank",
  "insurance",
  "fintech",
  "equity",
  "islamic",
  "development",
] as const;
export const STARTUP_STAGES = ["pre-seed", "seed", "growth", "mature"] as const;
export const INVESTOR_TYPES = ["angel", "vc", "pe", "strategic", "family", "institutional", "dfi"] as const;
export const INVESTOR_STAGES = ["pre-seed", "seed", "growth", "mature", "project"] as const;
export const INSTRUMENTS = ["equity", "convertible", "mezzanine", "debt", "jv", "project-equity"] as const;
export const IDEA_MODELS = ["sale", "license", "royalty", "equity", "codev", "bounty"] as const;
export const PROJECT_GATES = ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"] as const;

export type FinanceProduct = {
  id: string;
  name: string;
  summary: string;
  category: string;
  providerName: string;
  instrument: string;
  currency: string;
  rate: string;
  feeModel: string;
  collateral: string;
  eligibility: string;
  licence: string;
  link: string;
  minAmount: number;
  maxAmount: number;
  tenorMin: number;
  tenorMax: number;
  sla: number;
  updated: number;
  isSharia: boolean;
  isStale: boolean;
  docs: string[];
  segments: string[];
  rejectReasons: string[];
};

export function parseProduct(value: unknown): FinanceProduct {
  const item = record(value);
  return {
    id: text(item.id),
    name: text(item.name),
    summary: text(item.summary),
    category: text(item.category),
    providerName: text(item.providerName),
    instrument: text(item.instrument),
    currency: text(item.currency),
    rate: text(item.rate),
    feeModel: text(item.feeModel),
    collateral: text(item.collateral),
    eligibility: text(item.eligibility),
    licence: text(item.licence),
    link: text(item.link),
    minAmount: amount(item.minAmount),
    maxAmount: amount(item.maxAmount),
    tenorMin: amount(item.tenorMin),
    tenorMax: amount(item.tenorMax),
    sla: amount(item.sla),
    updated: amount(item.updated),
    isSharia: flag(item.sharia),
    isStale: flag(item.stale),
    docs: texts(item.docs),
    segments: texts(item.segments),
    rejectReasons: texts(item.rejectReasons),
  };
}

export type ProductListing = { items: FinanceProduct[]; total: number; disclaimer: string };

export const parseProductListing = (answer: Json): ProductListing => ({
  items: listOf(answer.items, parseProduct),
  total: amount(answer.total),
  disclaimer: text(answer.disclaimer),
});

export type FundingRequest = {
  id: string;
  status: string;
  category: string;
  currency: string;
  purpose: string;
  ownerName: string;
  sector: string;
  region: string;
  collateral: string;
  amount: number;
  tenor: number;
  offerCount: number;
  created: number;
  isSharia: boolean;
};

export function parseRequest(value: unknown): FundingRequest {
  const item = record(value);
  return {
    id: text(item.id),
    status: text(item.status),
    category: text(item.category),
    currency: text(item.currency),
    purpose: text(item.purpose),
    ownerName: text(item.ownerName),
    sector: text(item.sector),
    region: text(item.region),
    collateral: text(item.collateral),
    amount: amount(item.amount),
    tenor: amount(item.tenor),
    offerCount: amount(item.offerCount),
    created: amount(item.created),
    isSharia: flag(item.sharia),
  };
}

/** A product the server routed a request to, with the reasons behind the score. */
export type ProductMatch = MatchScore & { productName: string; providerName: string };

export function parseProductMatch(value: unknown): ProductMatch {
  const product = record(record(value).product);
  return { ...parseMatchScore(value), productName: text(product.name), providerName: text(product.providerName) };
}

export type Offer = {
  providerName: string;
  validity: string;
  ratePct: number;
  feePct: number;
  tenor: number;
  allInPct: number;
  isBestCost: boolean;
};

export function parseOffer(value: unknown): Offer {
  const item = record(value);
  return {
    providerName: text(item.providerName),
    validity: text(item.validity),
    ratePct: amount(item.ratePct),
    feePct: amount(item.feePct),
    tenor: amount(item.tenor),
    allInPct: amount(item.allInPct),
    isBestCost: flag(item.bestCost),
  };
}

/** What the offer form needs to know about the request it answers. */
export type OfferTarget = { id: string; amount: number; tenor: number; currency: string };

/** A request one of this provider's products is eligible for (POST /api/moliya/provider). */
export type Lead = MatchScore & OfferTarget & { product: string };

export function parseLead(value: unknown): Lead {
  const item = record(value);
  return {
    ...parseMatchScore(value),
    id: text(item.id),
    product: text(item.product),
    currency: text(item.currency),
    amount: amount(item.amount),
    tenor: amount(item.tenor),
  };
}

export type Passport = {
  ownerName: string;
  sector: string;
  region: string;
  legalForm: string;
  currency: string;
  purpose: string;
  collateral: string;
  risks: string;
  founded: number;
  employees: number;
  revenue: number;
  ebitda: number;
  need: number;
  tenor: number;
  collateralValue: number;
  docs: string[];
};

export function parsePassport(value: unknown): Passport | null {
  if (typeof value !== "object" || value === null) return null;
  const item = record(value);
  return {
    ownerName: text(item.ownerName),
    sector: text(item.sector),
    region: text(item.region),
    legalForm: text(item.legalForm),
    currency: text(item.currency),
    purpose: text(item.purpose),
    collateral: text(item.collateral),
    risks: text(item.risks),
    founded: amount(item.founded),
    employees: amount(item.employees),
    revenue: amount(item.revenue),
    ebitda: amount(item.ebitda),
    need: amount(item.need),
    tenor: amount(item.tenor),
    collateralValue: amount(item.collateralValue),
    docs: texts(item.docs),
  };
}

/** The funding-readiness gap map. It is not a credit score, and its note says so. */
export type Readiness = { score: number; note: string; blocks: Meter[] };

export function parseReadiness(value: unknown): Readiness | null {
  if (typeof value !== "object" || value === null) return null;
  const item = record(value);
  return { score: amount(item.score), note: text(item.note), blocks: listOf(item.blocks, parseMeter) };
}

export type StackScenario = {
  name: string;
  costOfCapital: string;
  note: string;
  dilution: number;
  sources: { label: string; amount: number; pct: number }[];
};

export function parseScenario(value: unknown): StackScenario {
  const item = record(value);
  return {
    name: text(item.name),
    costOfCapital: text(item.costOfCapital),
    note: text(item.note),
    dilution: amount(item.dilution),
    sources: listOf(item.sources, source => {
      const row = record(source);
      return { label: text(row.label), amount: amount(row.amount), pct: amount(row.pct) };
    }),
  };
}
