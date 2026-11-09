import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LOCAL_ASSET = /(<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*)(["'])([^"'?#]+\.(?:css|js))\2/gi;
const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

// Cloudflare hands browsers these files with a four-hour cache whatever nginx
// sends, while pages always revalidate. Without a version a release can pair
// new HTML with last release's CSS and JS, so each file's URL follows its content.
export function stampAssets(html, versionOf) {
  return html.replace(LOCAL_ASSET, (tag, before, quote, file) => {
    if (EXTERNAL.test(file)) return tag;
    const version = versionOf(file);
    return version ? `${before}${quote}${file}?v=${version}${quote}` : tag;
  });
}

export function stampDirectory(directory) {
  const versionOf = file => {
    const target = path.join(directory, file);
    return existsSync(target) ? createHash('sha256').update(readFileSync(target)).digest('hex').slice(0, 10) : null;
  };
  for (const name of readdirSync(directory).filter(file => file.endsWith('.html'))) {
    const page = path.join(directory, name);
    writeFileSync(page, stampAssets(readFileSync(page, 'utf8'), versionOf));
  }
}
