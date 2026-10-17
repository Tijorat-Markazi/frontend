/* ============================================================
   MENING MA'LUMOTLARIM — the standalone rights page

   The rights themselves now live in every cabinet's settings,
   which is where people will actually find them. This page still
   exists for the two cases a cabinet cannot cover:

   • the privacy policy links here, and a reader of the policy is
     not necessarily signed in;
   • someone whose access was suspended — including by their own
     withdrawal of consent — has no cabinet to open, and modda 22
     does not stop applying because an account was closed.

   So all this file does is establish who is asking, then hand
   over to LegalPanel. The four rights are implemented once, in
   legal-settings.js, and this page renders the same panel the
   cabinets do rather than a second copy that drifts from it.

   Restricted rights sessions allow only self-service data-rights operations.
   ============================================================ */
(async () => {
await KGAuth.ready();
const { $, esc, api, chrome, applyStatic } = MK;

MK.setDict(typeof T_DSR !== "undefined" ? T_DSR : {});

/* The server session is the sole identity source. */
let ME=KGAuth.current()?.authenticated?KGAuth.current().user:null;
const host = () => $("#dsrBody");

function mountPanel(){
  LegalPanel.mount(host(), {
    creds: () => ME,
    panelClass: "lg-page-panel",
    profileHref: KGAuth.current()?.role === "buyer" ? "xaridor.html" : "company.html",
    onWithdrawn: () => {
      KGAuth.logout().then(()=>{location.href="index.html";});
    },
  });
}

function drawLogin(msg){
  host().innerHTML = `
    <div class="lg-note lg-note-info">${esc(MK.t("dsr_login_why"))}</div>
    <form class="rg-card" id="dsrLogin" style="max-width:420px">
      <h2>${esc(MK.t("dsr_login_h"))}</h2>
      <div class="mk-form">
        <div class="mk-f wide"><label>${esc(MK.t("dsr_lg"))}</label>
          <input id="dsrLg" autocomplete="username" spellcheck="false" required /></div>
        <div class="mk-f wide"><label>${esc(MK.t("dsr_pw"))}</label>
          <input id="dsrPw" type="password" autocomplete="current-password" required /></div>
      </div>
      <div class="mk-actions"><button class="btn btn-primary" type="submit">${esc(MK.t("dsr_login_btn"))}</button></div>
      ${msg ? `<p class="mk-msg err">${esc(msg)}</p>` : ""}
    </form>`;

  $("#dsrLogin").addEventListener("submit", async e => {
    e.preventDefault();
    try{await KGAuth.login($("#dsrLg").value.trim(),$("#dsrPw").value,"rights");}
    catch(e){return drawLogin(MK.t("dsr_login_bad"));}
    ME=KGAuth.current().user;
    mountPanel();
  });
}

function draw(){
  if(ME) mountPanel(); else drawLogin("");
}

chrome(() => { applyStatic(); draw(); });
draw();
})();
