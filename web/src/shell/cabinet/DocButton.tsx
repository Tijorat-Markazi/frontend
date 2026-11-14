/**
 * DOC BUTTON — the "download as Word" control of a cabinet.
 *
 *   <DocButton path fallbackName body? className? id?>label</DocButton>
 *
 *     path   "/api/appeal/doc?id=…" — the document's parameters go in the query
 *     body   only for an endpoint that takes a JSON POST (the analyst export)
 *
 * Looks like the link it replaces, but fetches the file through the cookie
 * session (see download.ts) and says so when the server refuses.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { T_ANALYST } from "@legacy/markets-i18n.js";
import { dialogs } from "../dialogs";
import { useI18n } from "../i18n";
import { downloadDocument } from "./download";

type DocButtonProps = {
  path: string;
  fallbackName: string;
  /** The document's own parameters, when the endpoint reads them from a POST. */
  body?: object;
  className?: string;
  id?: string;
  children: ReactNode;
};

export function DocButton({ path, fallbackName, body, className = "btn btn-ghost", id, children }: DocButtonProps) {
  const { pick } = useI18n();
  const [isBusy, setIsBusy] = useState(false);

  const handleClick = async (): Promise<void> => {
    setIsBusy(true);
    const isSaved = await downloadDocument(path, fallbackName, body);
    setIsBusy(false);
    const failure = T_ANALYST.an_fail;
    if (!isSaved && failure) dialogs.toast(pick(failure), { tone: "error" });
  };

  return (
    <button type="button" className={className} id={id} disabled={isBusy} onClick={() => void handleClick()}>
      {children}
    </button>
  );
}
