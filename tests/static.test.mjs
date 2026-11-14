import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateStatic } from '../scripts/check-static.mjs';
import { stampAssets, stampDirectory } from '../scripts/version-assets.mjs';

test('every static page has valid scripts, existing assets and the shared session helper first', () => {
  const result = validateStatic();
  assert.ok(result.pages > 30);
  assert.ok(result.scripts > 40);
});

test('assistant history has no caller-selected email or panel identity and no fabricated failure response', () => {
  const source = readFileSync(new URL('../assistant.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /admin@konglomerat|demoReply|guestId:|\/api\/sessions\?email|panelAuth/);
  assert.match(source, /KGAuth\.json\("\/api\/sessions"\)/);
});

test('WebSocket authenticates by cookie and static serving does not mask a missing page', () => {
  const chat = readFileSync(new URL('../group-chat.js', import.meta.url), 'utf8');
  assert.match(chat, /JSON\.stringify\(\{op:"auth"\}\)/);
  assert.doesNotMatch(chat, /sock\.send\([^\n]*(?:password|creds|pass:)/);
  const nginx = readFileSync(new URL('../deploy/nginx.conf', import.meta.url), 'utf8');
  assert.match(nginx, /try_files \$uri \$uri\/ =404/);
  assert.doesNotMatch(nginx, /immutable|try_files[^;]*\/index\.html/);
});

test('local stylesheets and scripts are versioned and everything else is left alone', () => {
  const versionOf = file => ({ 'styles.css': 'aaa', 'auth.js': 'bbb' })[file];
  const page = quoted => [
    `<link rel="stylesheet" href=${quoted.css} />`,
    `<script defer src=${quoted.js}></script>`,
    '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />',
    '<script src="https://cdn.example.com/lib.js"></script>',
    '<link rel="icon" href="favicon.svg" />',
    '<a href="styles.css">styles</a>',
    '<script src="not-built.js"></script>',
  ].join('\n');
  const stamped = stampAssets(page({ css: '"styles.css"', js: "'auth.js'" }), versionOf);
  assert.equal(stamped, page({ css: '"styles.css?v=aaa"', js: "'auth.js?v=bbb'" }));
});

test('React bundles keep their own hashed names', () => {
  const page = '<script type="module" src="/_r/admin-YpwGuWSa.js"></script><link rel="modulepreload" href="/_r/shell-B1.js" /><link rel="stylesheet" href="/_r/standard-iG8.css" />';
  assert.equal(stampAssets(page, () => 'x'), page);
});

test('a changed file gets a new URL and an unchanged file keeps its URL', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'version-assets-'));
  const write = (name, text) => writeFileSync(path.join(directory, name), text);
  const release = css => {
    write('index.html', '<link rel="stylesheet" href="styles.css" /><script src="data.js"></script>');
    write('styles.css', css);
    write('data.js', 'var T = {};');
    stampDirectory(directory);
    return readFileSync(path.join(directory, 'index.html'), 'utf8').match(/"[^"]+\?v=[^"]+"/g);
  };
  try {
    const [firstCss, firstData] = release('.a{}');
    const [secondCss, secondData] = release('.b{}');
    assert.notEqual(firstCss, secondCss);
    assert.equal(firstData, secondData);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('no shipped page is left with an unversioned local stylesheet or script', () => {
  const root = new URL('../', import.meta.url);
  const reference = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+\.(?:css|js))["']/gi;
  for (const name of readdirSync(root).filter(file => file.endsWith('.html'))) {
    const stamped = stampAssets(readFileSync(new URL(name, root), 'utf8'), () => 'x');
    const unversioned = [...stamped.matchAll(reference)].map(match => match[1]).filter(url => !/^(?:https?:)?\/\//.test(url));
    assert.deepEqual(unversioned, [], name);
  }
});

test('the hero emblem keeps a small size of its own if the stylesheet is late or stale', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // the seal appears twice: beside the wordmark in the hero and in the structure band
  const emblems = html.match(/<svg class="hub-[^>]*>/g);
  assert.equal(emblems.length, 4);
  for (const svg of emblems) assert.match(svg, /\bwidth="\d+" height="\d+"/);
});
