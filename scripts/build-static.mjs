import { cpSync, mkdirSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import path from 'node:path';
import { root } from './check-static.mjs';

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
function lstatSafe(target) { try { return lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
copyAssets(path.join(root, 'assets'), path.join(output, 'assets'));
console.log('Staged only public static files in dist/.');
