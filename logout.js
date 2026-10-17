/* Header account navigation is based only on the server session. */
(function(){
 function label(){const lang=localStorage.getItem("kg_lang")||"uz";return {uz:"Chiqish",ru:"Выйти",en:"Log out"}[lang]||"Log out";}
 async function inject(){
  let s;try{s=await KGAuth.ready();}catch(_){return;}
  if(!s.authenticated||s.restricted)return;
  const panel=KGAuth.safeTarget(s.target)||"index.html";
  const cta=document.querySelector(".hero-cta .btn-primary");if(cta){cta.href=panel;cta.removeAttribute("data-i18n");cta.textContent={uz:"Panelimga qaytish →",ru:"Вернуться в панель →",en:"Back to the profile →"}[localStorage.getItem("kg_lang")||"uz"];}
  if(document.getElementById("logoutBtn")||document.getElementById("globalLogout"))return;
  const bar=document.querySelector(".header-actions");if(!bar)return;
  const btn=document.createElement("button");btn.id="globalLogout";btn.type="button";btn.className="btn btn-ghost";btn.textContent=label();
  btn.addEventListener("click",async()=>{btn.disabled=true;try{await KGAuth.logout();location.href="kirish.html";}catch(e){btn.disabled=false;UI.alert(e.message);}});
  bar.appendChild(btn);const lang=document.getElementById("langBtn");if(lang)lang.addEventListener("click",()=>setTimeout(()=>{btn.textContent=label();},0));
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",inject);else inject();
})();
