/* ============================================================
   Showroom product page.

   Every showroom entry now has its own address, and the page's
   real job is the second half of the user's ask: putting the
   visitor in touch with the company that published it. Member
   companies have no public phone or e-mail on file, so the
   connection is an inquiry thread — the buyer leaves a reachable
   contact, it lands in that company's Seller Center, and the
   reply comes back to this same page.
   ============================================================ */
(() => {
const { $, $$, t, esc, escA, safeUrl, num, day, api, qs, ident,
        chip, empty, loading, say, applyStatic, chrome } = MK;

MK.setDict(typeof T_PRODUCT !== "undefined" ? T_PRODUCT : {});

const ID = new URLSearchParams(location.search).get("id") || "";
let DATA = null;

async function load(){
  const root = $("#pdRoot");
  if(!ID){ root.innerHTML = empty(t("pd_missing")); return; }
  root.innerHTML = loading();
  const r = await api("/api/showroom/item?" + qs({ id: ID }));
  if(!r.ok){ root.innerHTML = empty(t("pd_notfound")); return; }
  DATA = r;
  render();
  loadThread();
}

function render(){
  const { product: p, company: c, more } = DATA;
  const img = safeUrl(p.img) || (p.img && p.img.startsWith("/") ? p.img : "");
  const assoc = (c.assocI18n && c.assocI18n[MK.lang()]) || c.assoc || "";

  $("#pdCrumbName").textContent = p.name;
  const crumbCo = $("#pdCrumbCompany");
  crumbCo.textContent = c.name;
  crumbCo.href = "showroom.html?company=" + encodeURIComponent(c.name);
  document.title = p.name + " — " + c.name + " — TIJORAT MARKAZI";

  $("#pdRoot").innerHTML = `
    <div class="pd-hero">
      <figure class="pd-media">
        ${img ? `<img src="${escA(img)}" alt="${escA(p.name)}" loading="eager" fetchpriority="high" />`
              : `<div class="pd-ph" aria-hidden="true">🛍️</div>`}
      </figure>
      <div class="pd-info">
        <div class="mk-chips">
          <span class="mk-chip is-${p.trade === "import" ? "b2g" : "export"}">${
            esc(p.trade === "import" ? t("pd_import") : t("pd_export"))}</span>
          ${c.sector ? chip(c.sector, "ghost") : ""}
        </div>
        <h1>${esc(p.name)}</h1>
        ${p.price ? `<div class="pd-price">${esc(p.price)}</div>`
                  : `<div class="pd-price pd-price-none">${esc(t("pd_price_ask"))}</div>`}
        ${p.desc ? `<p class="pd-desc">${esc(p.desc)}</p>` : ""}
        <dl class="mk-kv pd-kv">
          <dt>${esc(t("pd_company"))}</dt><dd><b>${esc(c.name)}</b></dd>
          ${c.bizId ? `<dt>Business ID</dt><dd><a class="pd-bizid" href="biznes-id.html?id=${encodeURIComponent(c.bizId)}">${esc(c.bizId)}</a></dd>` : ""}
          ${c.sector ? `<dt>${esc(t("pd_sector"))}</dt><dd>${esc(c.sector)}</dd>` : ""}
          ${assoc ? `<dt>${esc(t("pd_assoc"))}</dt><dd>${esc(assoc)}</dd>` : ""}
          ${c.chairman ? `<dt>${esc(t("pd_chairman"))}</dt><dd>${esc(c.chairman)}</dd>` : ""}
          <dt>${esc(t("pd_catalogue"))}</dt><dd>${num(c.products, 0)} ${esc(t("pd_items"))}</dd>
        </dl>
        <div class="mk-actions">
          <a class="btn btn-primary btn-lg" href="#pdContact">${esc(t("pd_contact_cta"))}</a>
          <a class="btn btn-ghost" href="showroom.html?company=${encodeURIComponent(c.name)}">${esc(t("pd_all_products"))}</a>
          ${c.bizId ? `<a class="btn btn-ghost" href="biznes-id.html?id=${encodeURIComponent(c.bizId)}">Business ID</a>` : ""}
        </div>
      </div>
    </div>

    <section class="pd-connect" id="pdContact">
      <div class="pd-connect-head">
        <h2>${esc(t("pd_contact_h"))}</h2>
        <p>${esc(t("pd_contact_p")).replace("{co}", esc(c.name))}</p>
      </div>
      <form class="mk-form" id="pdForm">
        <div class="mk-f"><label>${esc(t("pd_f_name"))}</label><input id="pdName" value="${escA(ident.name())}" required /></div>
        <div class="mk-f"><label>${esc(t("pd_f_org"))}</label><input id="pdOrg" /></div>
        <div class="mk-f"><label>${esc(t("pd_f_email"))}</label><input id="pdEmail" type="email" value="${escA(ident.email())}" /></div>
        <div class="mk-f"><label>${esc(t("pd_f_contact"))}</label><input id="pdContactVal" placeholder="+998 …" /></div>
        <div class="mk-f"><label>${esc(t("pd_f_country"))}</label><input id="pdCountry" /></div>
        <div class="mk-f"><label>${esc(t("pd_f_qty"))}</label><input id="pdQty" type="number" min="0" /></div>
        <div class="mk-f"><label>${esc(t("pd_f_unit"))}</label><input id="pdUnit" placeholder="kg / dona / tonna" /></div>
        <div class="mk-f wide"><label>${esc(t("pd_f_message"))}</label>
          <textarea id="pdMessage" placeholder="${escA(t("pd_msg_ph"))}"></textarea></div>
        <div class="mk-actions wide">
          <button class="btn btn-primary" type="submit">${esc(t("pd_send"))}</button>
          <span class="pd-hint">${esc(t("pd_contact_note"))}</span>
        </div>
        <p class="mk-msg wide" id="pdMsg" hidden></p>
      </form>
      <div id="pdThread"></div>
    </section>

    ${(more || []).length ? `<section class="pd-more">
      <h2>${esc(t("pd_more")).replace("{co}", esc(c.name))}</h2>
      <div class="show-grid">${more.map(m => `
        <a class="show-card" href="mahsulot.html?id=${encodeURIComponent(m.id)}">
          ${safeUrl(m.img) || (m.img || "").startsWith("/")
            ? `<img class="show-img" src="${escA(KGAuth.safeUrl(m.img,true))}" alt="" loading="lazy">`
            : `<div class="show-img show-img-ph">🛍️</div>`}
          <div class="show-body">
            <b>${esc(m.name)}</b>${m.price ? `<span class="show-price">${esc(m.price)}</span>` : ""}
            <span class="trade-badge trade-${esc(m.trade)}">${
              esc(m.trade === "import" ? t("pd_import") : t("pd_export"))}</span>
          </div>
        </a>`).join("")}</div>
    </section>` : ""}`;

  $("#pdForm").addEventListener("submit", send);
  applyStatic();
}

async function send(e){
  e.preventDefault();
  const msg = $("#pdMsg");
  const email = $("#pdEmail").value.trim();
  const contact = $("#pdContactVal").value.trim();
  if(!email && !contact) return say(msg, t("pd_need_contact"), "err");

  const r = await api("/api/bozor/inquiry", {
    companyId: DATA.company.id, productId: DATA.product.id, source: "showroom",
    name: $("#pdName").value.trim(), company: $("#pdOrg").value.trim(),
    email, contact, country: $("#pdCountry").value.trim(),
    qty: $("#pdQty").value, unit: $("#pdUnit").value.trim(),
    message: $("#pdMessage").value.trim(),
  });
  if(!r.ok) return say(msg, r.error === "contact_required" ? t("pd_need_contact") : t("pd_send_fail"), "err");

  /* Remember the address so the reply can be shown next time they visit. */
  if(email) await ident.setPerson(email, $("#pdName").value.trim());
  say(msg, t("pd_send_ok").replace("{co}", DATA.company.name), "ok");
  $("#pdMessage").value = "";
  loadThread();
}

/* The buyer's own inquiries to this company, with the company's replies. */
async function loadThread(){
  const host = $("#pdThread");
  if(!host || !DATA) return;
  const r = await api("/api/bozor/inquiry/mine", {});
  const mine = (r.items || []).filter(i => i.productId === DATA.product.id
    || i.companyName === DATA.company.name);
  host.replaceChildren();
  if(!mine.length) return;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
  const thread=node("div","pd-thread");thread.append(node("h3","",t("pd_thread")));
  for(const inquiry of mine){
    const article=node("article","pd-msg"),head=node("div","pd-msg-top");
    const kind=inquiry.status==="answered"?"good":inquiry.status==="closed"?"ghost":"warn";
    head.append(node("b","",inquiry.productName||DATA.product.name),node("span","mk-chip is-"+kind,t("pd_st_"+inquiry.status,inquiry.status)),node("span","pd-msg-date",day(inquiry.created)));
    article.append(head);if(inquiry.message)article.append(node("p","",inquiry.message));
    for(const reply of inquiry.replies||[]){const row=node("div","pd-reply");row.append(node("b","",reply.by),node("span","pd-msg-date",day(reply.t)),node("p","",reply.text));article.append(row);}
    if(!(inquiry.replies||[]).length)article.append(node("p","pd-hint",t("pd_awaiting")));
    thread.append(article);
  }
  host.append(thread);
}

chrome(() => { if(DATA) { render(); loadThread(); } });
load();
})();
