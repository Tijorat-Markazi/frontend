import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStatic } from '../scripts/check-static.mjs';

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
