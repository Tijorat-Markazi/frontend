import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const hostile = '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">';

function renderer(file, name) {
  const context = vm.createContext({
    localStorage: { getItem: () => null }, LANGS: ['uz', 'ru', 'en'], T: {},
    URLSearchParams, location: { search: '', href: 'https://example.test/' },
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  });
  vm.runInContext(source('market-kit.js'), context);
  const boot = /chrome\(\);\s*applyStatic\(\);\s*load\(\);/;
  const page = source(file);
  assert.match(page, boot, 'renderer fixture must replace only page bootstrap');
  vm.runInContext(page.replace(boot, `globalThis.renderForTest=${name};`), context);
  return context.renderForTest;
}

function escaped(html) {
  assert.ok(html.includes('&lt;script&gt;'), 'untrusted text remains visible as text');
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript:|data:text\/html)/i);
}

test('public Business ID renderer escapes hostile names, contacts and product values', () => {
  const render = renderer('biznes-id.js', 'renderBusinessIdCard');
  escaped(render({ kind: 'company', name: hostile, bizId: hostile, sector: hostile, productCount: 1,
    contact: { phone: hostile, email: hostile, location: hostile, website: 'javascript:window.__xss=1' },
    showroom: [{ id: hostile, name: hostile, price: hostile, img: 'javascript:window.__xss=1' }], companies: [],
  }));
});

test('public company renderer escapes company, association and catalogue data', () => {
  const render = renderer('korxona.js', 'renderPublicCompany');
  escaped(render({ company: { name: hostile, sector: hostile, bizId: hostile },
    assoc: { id: hostile, name: hostile, chairman: hostile },
    showroom: [{ id: hostile, name: hostile, price: hostile, img: 'javascript:window.__xss=1' }],
  }));
});

test('meeting formatters never return invalid date markup as HTML', () => {
  for (const file of ['association.js', 'company.js']) {
    const declaration = source(file).match(/^function fmtDateTime\(s\).*$/m)?.[0];
    assert.ok(declaration, file);
    const format = vm.runInNewContext('(' + declaration + ')');
    assert.equal(format(hostile), '', file);
  }
});
