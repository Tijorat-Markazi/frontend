/* What the association cabinet's test files share: the account the server
   answers with, and the steps that open the cabinet on a cookie session. */
import { fireEvent, screen } from "@testing-library/react";
import { signInAs, stubCabinetApi } from "../../shell/cabinet/testApi";
import type { ApiRoute } from "../../shell/cabinet/testApi";
import { HOSTILE, renderPage } from "../../test/renderPage";
import { AssociationPage } from "./AssociationPage";
import { AT } from "./text";

export const COMPANIES = [
  { id: "c1", name: "Alfa MChJ", sector: "Paxta", login: "alfa", created: Date.now(), showroom: [{ name: "Ip", price: "5$" }] },
  { id: "c2", name: HOSTILE, sector: "", login: "beta", created: null, showroom: [] },
];
const ACCOUNT = { assoc: { id: "a1", name: "Paxta", i18n: { uz: "Paxta uyushmasi", ru: "Хлопок" }, chairman: "Karimov" }, companies: COMPANIES };
export const BASE: Record<string, ApiRoute> = {
  "/api/assoc/login": ACCOUNT,
  "/api/conference?assoc=a1": { title: "Yig'ilish" },
  "/api/register/list": { ok: true, counts: { pending: 2 }, items: [] },
};

/* The cookie session the page finds: the chairman signed in before it opened. */
export function signIn(): void {
  signInAs("assoc", { id: "a1", name: "Paxta" });
}

export async function openCabinet(routes: Record<string, ApiRoute> = {}) {
  signIn();
  const calls = stubCabinetApi({ ...BASE, ...routes });
  const view = renderPage(<AssociationPage />);
  await screen.findByRole("heading", { level: 1, name: AT.nav_dash[0] });
  return { ...view, calls };
}

export function openView(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
}

export function submitLogin(container: HTMLElement, login: string, password: string): void {
  container.querySelector<HTMLInputElement>("#asLoginInp")!.value = login;
  container.querySelector<HTMLInputElement>("#asPassInp")!.value = password;
  fireEvent.submit(container.querySelector("#asForm")!);
}
