/*
 * TEST HELPERS for the labour-market page: the fixtures both test files
 * share, and the page rendered with its vacancies loaded.
 */
import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";
import { T_MEHNAT } from "@legacy/markets-i18n.js";
import { identity } from "../../shell/market";
import { setTestSession } from "../../test/fakeSession";
import { HOSTILE, renderPage, stubApi } from "../../test/renderPage";
import { MehnatPage } from "./MehnatPage";

export const uz = (key: string): string => T_MEHNAT[key]![0];

export const JOBS = "/api/mehnat/jobs?";
export const ACCOUNTANT = {
  id: "v1",
  title: "Bosh hisobchi",
  companyName: "Alfa",
  seniority: "senior",
  format: "onsite",
  salaryMin: 900,
  salaryMax: 900,
  currency: "USD",
  skillsRequired: ["IFRS"],
  summary: "Hisobot",
  duties: "Balans",
};
export const DRIVER = { id: "v2", title: "Haydovchi", companyName: "Beta", seniority: "junior", format: "onsite" };
export const LISTING = {
  items: [ACCOUNTANT, DRIVER],
  total: 2,
  facets: { regions: ["Toshkent"], seniority: ["junior", "senior"], formats: ["onsite"] },
};
/* What POST /api/company/login answers for the session's company. */
export const COMPANY_ANSWER = { ok: true, company: { id: "c1", name: "Alfa", sector: "Agro" } };
export const SECRET = "s3cret-pair";
export const asCompany = (): void =>
  setTestSession({ authenticated: true, role: "company", target: "company.html", user: { id: "c1", name: "Alfa" } });
/* The address a visitor saved earlier comes back on the guest session. */
export const asKnownGuest = (): void => setTestSession({ guest: { email: "ali@example.uz", name: "Ali" } });
export const EMPLOYER = {
  ok: true,
  vacancies: [{ id: "v1", title: "Bosh hisobchi", status: "open", seniority: "senior" }],
  pipeline: {
    funnel: { applied: 1 },
    stages: ["applied", "rejected", "withdrawn"],
    byStage: {
      applied: [{ id: "a1", stage: "applied", candidateName: HOSTILE, vacancyTitle: "Bosh hisobchi", score: 70 }],
    },
  },
};

type FetchStub = ReturnType<typeof vi.fn>;

export const postsTo = (path: string): Record<string, unknown>[] =>
  (fetch as unknown as FetchStub).mock.calls
    .filter(([url, options]) => url === path && options)
    .map(([, options]) => JSON.parse((options as { body: string }).body) as Record<string, unknown>);

export const sentRequests = (): { url: string; body: Record<string, unknown> }[] =>
  (fetch as unknown as FetchStub).mock.calls.map(([url, options]) => ({
    url: String(url),
    body: JSON.parse((options as { body?: string } | undefined)?.body ?? "{}") as Record<string, unknown>,
  }));

export const openTab = (key: string): void => {
  fireEvent.click(screen.getByRole("tab", { name: uz(key) }));
};

export async function renderJobs(routes: Record<string, unknown> = {}) {
  stubApi({ [JOBS]: LISTING, ...routes });
  const view = renderPage(<MehnatPage />);
  await screen.findByText("Bosh hisobchi");
  return view;
}

/* The kit remembers the last saved contact for the life of the page; each
   test starts as a visitor who has typed nothing. Call it from afterEach:
   that runs before setup.ts resets the session and the call counts. */
export async function forgetContact(): Promise<void> {
  await identity.setPerson("", "");
}
