import { CabinetLogin, cabinetPost, useCabinetLogin } from "../../shell/cabinet";
import { dialogs } from "../../shell/dialogs";
import { goTo } from "../../shell/navigate";
import { PageBackground } from "../../shell/PageBackground";
import { auth } from "../../shell/session";
import { AssociationCabinet } from "./AssociationCabinet";
import { PublicAssociation } from "./PublicAssociation";
import { parseAssociation, parseCompanies, useAssocText } from "./types";
import type { Account } from "./types";

/* The server reads the association from the cookie session; the body stays empty. */
async function loadAccount(): Promise<Account | null> {
  const answer = await cabinetPost("/api/assoc/login", {});
  if (!answer.isOk || !answer.body.assoc) return null;
  return { assoc: parseAssociation(answer.body.assoc), companies: parseCompanies(answer.body.companies) };
}

/* Leaving the cabinet lands on the directory, and only once the server has
   really ended the session; when it cannot be reached the cabinet stays open
   and a dialog says why. */
async function leaveCabinet(): Promise<void> {
  try {
    await auth.logout();
    goTo("associations.html");
  } catch (error: unknown) {
    void dialogs.alert(error instanceof Error ? error.message : String(error));
  }
}

function CabinetGate() {
  const at = useAssocText();
  const { state, submit } = useCabinetLogin<Account>({
    role: "assoc",
    ownPage: "association.html",
    signIn: loadAccount,
  });

  /* Nothing is shown while the server is asked who is signed in. */
  if (state.status === "checking") return null;
  if (state.status === "signedOut") {
    return (
      <CabinetLogin
        idPrefix="as"
        title={at("lg_title")}
        lead={at("lg_sub")}
        buttonLabel={at("lg_btn")}
        errorText={at("err")}
        onSubmit={submit}
      />
    );
  }
  return <AssociationCabinet account={state.account} onLogout={() => void leaveCabinet()} />;
}

export function AssociationPage() {
  /* ?id=… is an explicit request for one association's PUBLIC page, so it wins
     even when a chairman is signed in: otherwise they could never look at
     another association's profile. No id means this is the panel. */
  const publicId = new URLSearchParams(window.location.search).get("id");
  if (publicId) return <PublicAssociation id={publicId} />;
  return (
    <>
      <PageBackground />
      <CabinetGate />
    </>
  );
}
