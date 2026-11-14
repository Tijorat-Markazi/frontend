/**
 * TEST HELPER shared by the finance market's test files: the fixtures and the
 * few gestures every one of them repeats. Not shipped.
 */
import { fireEvent, screen } from "@testing-library/react";
import { T_MOLIYA } from "@legacy/markets-i18n.js";
import { stubCabinetApi } from "../../shell/cabinet/testApi";
import type { ApiCall, ApiRoute } from "../../shell/cabinet/testApi";
import { renderPage } from "../../test/renderPage";
import { MoliyaPage } from "./MoliyaPage";

export const uz = (key: string): string => T_MOLIYA[key]![0];

export const PRODUCTS = "/api/moliya/products?";
export const LOAN = {
  id: "p1",
  name: "Aylanma kredit",
  providerName: "Alfa Bank",
  category: "banking",
  currency: "USD",
  minAmount: 1000,
  maxAmount: 5000,
  tenorMin: 6,
  tenorMax: 36,
  link: "https://alfa.example/loan",
  rejectReasons: ["Garov yetarli emas"],
};
export const MURABAHA = { id: "p2", name: "Murobaha", providerName: "Islom Lizing", category: "islamic", sharia: true };
export const LISTING = { items: [LOAN, MURABAHA], total: 2, disclaimer: "Shartlar o'zgarishi mumkin" };

export const REQUEST = {
  id: "r1",
  status: "open",
  amount: 5000,
  currency: "USD",
  tenor: 12,
  purpose: "Uskuna xaridi",
  ownerName: "Anonim korxona",
  offerCount: 1,
};
export const REQUEST_ROUTES = {
  "/api/moliya/requests": { items: [REQUEST] },
  "/api/moliya/request/matches?id=r1": { ok: true, request: REQUEST, matches: [] },
};

export const COMPANY_USER = { id: "c1", name: "Alfa Bank" };

export type { ApiRoute };
export type Routes = Record<string, ApiRoute>;

/** The page with its first product list on screen, and every request it makes from then on. */
export async function renderMoliya(routes: Routes = {}): Promise<{ container: HTMLElement; calls: ApiCall[] }> {
  const calls = stubCabinetApi({ [PRODUCTS]: LISTING, ...routes });
  const { container } = renderPage(<MoliyaPage />);
  await screen.findByText("Aylanma kredit");
  return { container, calls };
}

export function openTab(key: string): void {
  fireEvent.click(screen.getByRole("tab", { name: uz(key) }));
}

export function typeInto(container: ParentNode, selector: string, value: string): void {
  fireEvent.change(container.querySelector(selector)!, { target: { value } });
}

export const urlsOf = (calls: readonly ApiCall[]): string[] => calls.map(call => call.url);

/** The drawer is rendered outside the page, straight into the document. */
export const drawer = (): HTMLElement | null => document.querySelector<HTMLElement>("#mkDrawer");
