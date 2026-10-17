import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../auth.js', import.meta.url), 'utf8');
const guest = (token = 'guest-csrf') => ({ ok: true, authenticated: false, role: 'guest', user: null, csrfToken: token });
function storage(values = {}) {
  const data = { ...values };
  Object.defineProperty(data, 'removeItem', { value(key) { delete data[key]; } });
  return data;
}
function client(handler) {
  const calls = [], events = [];
  const localStorage = storage({ kg_co: 'legacy-password', mk_co: 'legacy-password', mk_iqkey: 'legacy-capability', kg_chats_old: 'private', kg_lang: 'uz' });
  const sessionStorage = storage({ kg_admin: '1' });
  const window = {
    location: { href: 'https://example.uz/company.html', origin: 'https://example.uz', pathname: '/company.html', replace() {} },
    localStorage, sessionStorage,
    dispatchEvent(event) { events.push(event); },
    async fetch(path, options = {}) {
      calls.push({ path, options });
      const value = await handler(path, options);
      return new Response(JSON.stringify(value.body ?? value), { status: value.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    },
  };
  const context = vm.createContext({ window, URL, Headers, AbortSignal, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
  vm.runInContext(source, context);
  return { auth: window.KGAuth, calls, localStorage, sessionStorage, events };
}

test('legacy credentials, flags and private browser archives are cleared; UI preferences survive', () => {
  const c = client(() => guest());
  assert.equal(c.localStorage.kg_co, undefined);
  assert.equal(c.localStorage.mk_co, undefined);
  assert.equal(c.localStorage.mk_iqkey, undefined);
  assert.equal(c.localStorage.kg_chats_old, undefined);
  assert.equal(c.sessionStorage.kg_admin, undefined);
  assert.equal(c.localStorage.kg_lang, 'uz');
  assert.equal(c.auth.user(), null);
});

test('concurrent session initialization is shared and every write sends same-origin cookie plus CSRF', async () => {
  const c = client(path => path === '/api/auth/session' ? guest() : { ok: true });
  await Promise.all([c.auth.ready(), c.auth.ready(), c.auth.ready()]);
  assert.equal(c.calls.length, 1);
  const signal = new AbortController().signal;
  await c.auth.json('/api/company/showroom', { items: [] }, { signal });
  const call = c.calls[1];
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(call.options.headers.get('X-CSRF-Token'), 'guest-csrf');
  assert.equal(call.options.headers.has('Authorization'), false);
  assert.equal(call.options.signal, signal);
  assert.deepEqual(JSON.parse(call.options.body), { items: [] });
});

test('parallel public API reads await a single guest-cookie bootstrap', async () => {
  const c = client(path => path === '/api/auth/session' ? guest() : { ok: true });
  await Promise.all([c.auth.json('/api/showroom'), c.auth.json('/api/assoc/list')]);
  assert.equal(c.calls[0].path, '/api/auth/session');
  assert.equal(c.calls.filter(call => call.path === '/api/auth/session').length, 1);
  assert.equal(c.calls.length, 3);
});

test('login rotates in-memory identity and CSRF; metadata never goes into browser storage', async () => {
  const signed = { ...guest('account-csrf'), authenticated: true, role: 'company', target: 'company.html', user: { id: 'company-1', name: 'Company' } };
  const c = client(path => path === '/api/auth/session' ? guest() : path === '/api/auth/login' ? signed : { ok: true });
  await c.auth.login('company', 'secret');
  assert.equal(c.auth.user(['company']).id, 'company-1');
  assert.equal(c.auth.user(['admin']), null);
  await c.auth.json('/api/company/items', { module: 'service' });
  assert.equal(c.calls.at(-1).options.headers.get('X-CSRF-Token'), 'account-csrf');
  assert.equal(c.localStorage.kg_co, undefined);
  assert.equal(c.sessionStorage.kg_co, undefined);
  assert.equal(JSON.parse(c.calls[1].options.body).password, 'secret');
});

test('restricted rights session cannot be used as a cabinet session', async () => {
  const c = client(() => ({ ...guest(), authenticated: true, role: 'company', restricted: true, user: { id: 'company-1' } }));
  await c.auth.ready();
  assert.equal(c.auth.user(['company']), null);
});

test('logout replaces account metadata with a new guest session', async () => {
  const c = client(path => path === '/api/auth/logout' ? guest('new-guest') : ({ ...guest(), authenticated: true, role: 'admin', user: { id: 'admin' } }));
  await c.auth.ready();
  await c.auth.logout();
  assert.equal(c.auth.current().role, 'guest');
  assert.equal(c.auth.user(), null);
});

test('a failed write is sent once; authentication failure invalidates cached identity', async () => {
  const c = client(path => path === '/api/auth/session' ? guest() : { status: 401, body: { error: 'login_required' } });
  await assert.rejects(c.auth.json('/api/group', { op: 'send', text: 'test' }), /login_required/);
  assert.equal(c.calls.filter(call => call.path === '/api/group').length, 1);
  assert.equal(c.auth.current(), null);
});

test('external API destinations are rejected before credentials can leave the origin', async () => {
  const c = client(() => guest());
  await assert.rejects(c.auth.json('https://other.example/api', {}), /same origin/);
  assert.equal(c.calls.length, 0);
});

test('upload rejection surfaces HTTP 413 and safe URL rendering rejects executable schemes', async () => {
  const c = client(path => path === '/api/auth/session' ? guest() : { status: 413, body: { error: 'too_large' } });
  await assert.rejects(c.auth.json('/api/upload', { data: 'x' }), error => error.status === 413 && /8 MiB/.test(error.message));
  assert.equal(c.auth.safeUrl('javascript:alert(1)'), '');
  assert.equal(c.auth.safeUrl('data:image/svg+xml,<svg/>', true), '');
  assert.equal(c.auth.safeUrl('/uploads/file.pdf'), '/uploads/file.pdf');
  assert.equal(c.auth.safeTarget('https://evil.example/page.html'), null);
  assert.equal(c.auth.escape('"<script>&'), '&quot;&lt;script&gt;&amp;');
});
