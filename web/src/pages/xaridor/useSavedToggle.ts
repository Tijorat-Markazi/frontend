import { useState } from "react";
import { listOf } from "../../shell/market";
import { buyerPost, parseSupplier } from "./types";
import type { Supplier } from "./types";

type SavedToggle = { pendingId: string | null; toggle: (companyId: string) => Promise<void> };

/** Adds a seller to the shortlist, or drops one already on it. */
export function useSavedToggle(onSaved: (suppliers: Supplier[]) => void): SavedToggle {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const toggle = async (companyId: string): Promise<void> => {
    setPendingId(companyId);
    const answer = await buyerPost("/api/buyer/saved", { companyId });
    setPendingId(null);
    if (answer.ok) onSaved(listOf(answer.suppliers, parseSupplier));
  };

  return { pendingId, toggle };
}
