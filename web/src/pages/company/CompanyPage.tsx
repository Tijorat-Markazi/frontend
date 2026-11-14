import { CabinetLogin, cabinetPost, useCabinetLogin } from "../../shell/cabinet";
import { PageBackground } from "../../shell/PageBackground";
import { CompanyCabinet } from "./CompanyCabinet";
import { parseCompany, useCompanyText } from "./types";
import type { Company } from "./types";

/* The server reads the company from the cookie session; the body stays empty. */
async function loadCompany(): Promise<Company | null> {
  const answer = await cabinetPost("/api/company/login", {});
  return answer.isOk ? parseCompany(answer.body.company) : null;
}

function CabinetGate() {
  const ot = useCompanyText();
  const { state, submit, signOut } = useCabinetLogin<Company>({
    role: "company",
    ownPage: "company.html",
    signIn: loadCompany,
  });

  /* Nothing is shown while the server is asked who is signed in. */
  if (state.status === "checking") return null;
  if (state.status === "signedOut") {
    return (
      <CabinetLogin
        idPrefix="co"
        title={ot("lg_title")}
        lead={ot("lg_sub")}
        buttonLabel={ot("lg_btn")}
        errorText={ot("err")}
        onSubmit={submit}
      />
    );
  }
  /* Signing out of the company cabinet stays on the page and shows the form. */
  return <CompanyCabinet company={state.account} onLogout={signOut} />;
}

export function CompanyPage() {
  return (
    <>
      <PageBackground />
      <CabinetGate />
    </>
  );
}
