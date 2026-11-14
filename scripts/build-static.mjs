import { cpSync, mkdirSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import path from 'node:path';
import { root } from './check-static.mjs';
import { stampDirectory } from './version-assets.mjs';

const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unsafe output directory');
if (lstatSafe(output)?.isSymbolicLink()) throw new Error('Output must not be a symbolic link');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
const publicExtensions = new Set(['.html', '.css', '.js', '.svg', '.ico']);
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && publicExtensions.has(path.extname(entry.name))) cpSync(path.join(root, entry.name), path.join(output, entry.name));
}
function copyAssets(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const item of readdirSync(source, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Asset symlinks are not allowed');
    const from = path.join(source, item.name), to = path.join(destination, item.name);
    if (item.isDirectory()) copyAssets(from, to);
    else if (/\.(?:svg|png|jpe?g|webp|gif|avif|ico|woff2?|ttf|otf|mp4|webm|mp3|ogg)$/i.test(item.name)) cpSync(from, to);
  }
}
// A page converted to React replaces its old file of the same name; its bundles
// live in _r/. The old scripts stay beside it until every page is converted.
function overlayReactPages(built) {
  if (!lstatSafe(built)?.isDirectory()) throw new Error('web/dist is missing: run "npm run build" so the React pages are built first');
  const pages = readdirSync(built, { withFileTypes: true }).filter(item => item.isFile() && item.name.endsWith('.html'));
  if (!pages.length) throw new Error('web/dist holds no pages');
  for (const page of pages) cpSync(path.join(built, page.name), path.join(output, page.name));
  const bundles = path.join(built, '_r');
  if (!lstatSafe(bundles)?.isDirectory()) throw new Error('web/dist/_r is missing');
  copyBundles(bundles, path.join(output, '_r'));
  console.log(`Overlaid ${pages.length} React pages.`);
}
function copyBundles(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const item of readdirSync(source, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Bundle symlinks are not allowed');
    const from = path.join(source, item.name), to = path.join(destination, item.name);
    if (item.isDirectory()) copyBundles(from, to);
    else if (/.(?:js|css|svg|png|jpe?g|webp|gif|avif|woff2?)$/i.test(item.name)) cpSync(from, to);
  }
}
function lstatSafe(target) { try { return lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
copyAssets(path.join(root, 'assets'), path.join(output, 'assets'));
overlayReactPages(path.join(root, 'web', 'dist'));
stampDirectory(output);
console.log('Staged only public static files in dist/.');
