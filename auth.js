/* One same-origin, HttpOnly-cookie session for every page. No credentials in storage. */
(function (global) {
  "use strict";
  const nativeFetch = global.fetch.bind(global);
  const legacyKeys = ["kg_admin", "kg_rais", "kg_as", "kg_co", "kg_an", "kg_by", "mk_co",
    "kg_email", "kg_guest_id", "kg_demo_email", "mk_email", "mk_name", "mk_iqkey"];
  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      const storage=global[name];
      legacyKeys.forEach(key => storage.removeItem(key));
      Object.keys(storage).filter(key => /^kg_(chats|problems)_/.test(key)).forEach(key => storage.removeItem(key));
    } catch (_) { /* Storage may be disabled. Cookies remain the authority. */ }
  }
  let session = null, pending = null;
  function accept(value) {
    if (!value || !value.ok || typeof value.csrfToken !== "string") throw new Error("Invalid session response");
    session = value;
    global.dispatchEvent(new CustomEvent("kg:session", { detail: value }));
    return value;
  }
  async function ready(refresh) {
    if (session && !refresh) return session;
    if (!pending) pending = (async () => {
      const response = await nativeFetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Session service unavailable");
      return accept(await response.json());
    })().finally(() => { pending = null; });
    return pending;
  }
  async function request(path, options) {
    const url = new URL(path, global.location.href);
    if (url.origin !== global.location.origin) throw new Error("API requests must use the same origin");
    const opts = Object.assign({}, options || {});
    const method = String(opts.method || "GET").toUpperCase();
    opts.credentials = "same-origin";
    opts.headers = new Headers(opts.headers || {});
    // Bootstrap once before parallel GETs can race to create different guest cookies.
    const current = await ready();
    if (!/^(GET|HEAD|OPTIONS)$/.test(method)) {
      opts.headers.set("X-CSRF-Token", current.csrfToken);
    }
    opts.cache = "no-store";
    if(!opts.signal)opts.signal=AbortSignal.timeout(180000);
    // Never replay writes automatically: a lost response may already have committed.
    const response = await nativeFetch(url.pathname + url.search, opts);
    if (response.status === 401) { session = null; global.dispatchEvent(new CustomEvent("kg:expired")); }
    return response;
  }
  async function json(path, body, options) {
    const opts = Object.assign({}, options || {});
    if (body !== undefined) {
      opts.method = opts.method || "POST";
      opts.headers = new Headers(opts.headers || {});
      opts.headers.set("Content-Type", "application/json");
      opts.body = JSON.stringify(body);
    }
    const response = await request(path, opts);
    let value;
    try { value = await response.json(); } catch (_) { throw new Error("Invalid server response"); }
    if (!response.ok) {
      const error = new Error(response.status === 413 ? "File too large (8 MiB max)" : (value.error || "Request failed"));
      error.status = response.status;
      throw error;
    }
    return value;
  }
  async function login(loginName, password, purpose) {
    await ready();
    const value = await json("/api/auth/login", { login: String(loginName || "").trim(), password: String(password || ""),
      ...(purpose ? { purpose } : {}) });
    return accept(value);
  }
  async function logout() { return accept(await json("/api/auth/logout", {})); }
  async function guest(email, name) { return accept(await json("/api/auth/guest", { email, name })); }
  function user(roles) {
    if (!session || !session.authenticated || session.restricted) return null;
    return !roles || roles.includes(session.role) ? session.user : null;
  }
  function safeTarget(target) { return /^[a-z0-9._-]+\.html$/i.test(target || "") ? target : null; }
  function safeUrl(value, images) {
    if (!String(value || "").trim()) return "";
    try {
      const url = new URL(String(value), global.location.href);
      if (url.origin === global.location.origin && /^https?:$/.test(url.protocol)) return url.pathname + url.search + url.hash;
      if (/^https?:$/.test(url.protocol)) return url.href;
      if (images && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(String(value))) return String(value);
    } catch (_) { /* Invalid URLs are rendered without a link. */ }
    return "";
  }
  const escape=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  global.KGAuth = { escape, ready, fetch: request, json, login, logout, guest, user, current: () => session, safeTarget, safeUrl };
  global.kgResolveLogin = async function (loginName, password) {
    try { const value = await login(loginName, password); return safeTarget(value.target); }
    catch (_) { return null; }
  };
  global.kgRequireLogin = function (next) {
    const target = safeTarget(next || global.location.pathname.split("/").pop()) || "index.html";
    global.location.replace("kirish.html?next=" + encodeURIComponent(target));
  };
  global.addEventListener?.("focus", async function () {
    if (!session) return;
    const identity = value => `${value?.role}:${value?.user?.id || "guest"}:${!!value?.restricted}`;
    const before = identity(session);
    try {
      await ready(true);
      if (before !== identity(session)) global.location.reload();
    } catch (_) { /* Requests still report backend availability errors. */ }
  });
})(window);
