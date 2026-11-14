/* What both company test files share: the account, the routes every cabinet
   opens with, and the few gestures the tests repeat. */
import { fireEvent, screen } from "@testing-library/react";
import { signInAs, stubCabinetApi } from "../../shell/cabinet/testApi";
import type { ApiRoute } from "../../shell/cabinet/testApi";
import { HOSTILE, renderPage } from "../../test/renderPage";
import { CompanyPage } from "./CompanyPage";
import { OT } from "./text";

export const COMPANY_SESSION = { role: "company", target: "company.html", user: { id: "c1", role: "company", name: "Alfa MChJ" } };
export const SHOWROOM = [
  { name: "Ip", price: "5$", desc: "Paxta ipi", img: "/uploads/ip.jpg", trade: "export" },
  { name: HOSTILE, price: "", desc: "", img: "javascript:alert(1)", trade: "import" },
];
export const COMPANY = {
  id: "c1", name: "Alfa MChJ", sector: "Paxta", assocId: "a1", assocName: "Paxta", assocI18n: { uz: "Paxta uyushmasi", ru: "Хлопок" },
  showroom: SHOWROOM, bizrows: [{ product: "Ip", sales: "40 000$", price: "1,200", composition: "", note: "" }],
};
export const BASE: Record<string, ApiRoute> = {
  "/api/company/login": { ok: true, company: COMPANY },
  "/api/bozor/inquiries": { ok: true, unread: 3, items: [] },
  "/api/conference?assoc=a1": { id: "m 1", title: HOSTILE, datetime: "2026-04-01T10:00", link: "https://meet.example/x" },
};

export async function openCabinet(routes: Record<string, ApiRoute> = {}) {
  signInAs("company", { id: "c1", name: "Alfa MChJ" });
  const calls = stubCabinetApi({ ...BASE, ...routes });
  const view = renderPage(<CompanyPage />);
  await screen.findByRole("heading", { level: 1, name: OT.nav_dash[0] });
  return { ...view, calls };
}

export function openView(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
}

export function submitLogin(container: HTMLElement, login: string, password: string): void {
  container.querySelector<HTMLInputElement>("#coLoginInp")!.value = login;
  container.querySelector<HTMLInputElement>("#coPassInp")!.value = password;
  fireEvent.submit(container.querySelector("#coForm")!);
}
