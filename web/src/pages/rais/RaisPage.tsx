import { useEffect } from "react";
import { replaceWith } from "../../shell/navigate";
import { PageBackground } from "../../shell/PageBackground";
import { auth } from "../../shell/session";
import { LINK, NOTICE } from "./text";

const ADMIN_PAGE = "admin.html";

/* The rais uses the shared admin oversight panel, so this page is only a
   notice and a redirect. It asks for no sign-in of its own: the admin panel
   decides who may see it. */
export function RaisPage() {
  useEffect(() => {
    let isCurrent = true;
    const leave = () => {
      if (isCurrent) replaceWith(ADMIN_PAGE);
    };
    /* The session is settled first, as rais.js does, so the admin panel opens
       on it; an unreachable server must not strand the visitor here. */
    auth.ready().then(leave, leave);
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <>
      <PageBackground />
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          fontFamily: "Inter,sans-serif",
          color: "var(--text)",
        }}
      >
        <div>
          <p style={{ fontSize: 18, marginBottom: 10 }}>{NOTICE}</p>
          <p>
            <a href={ADMIN_PAGE} style={{ color: "var(--navy)", fontWeight: 600 }}>
              {LINK}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
