import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function validateStatic(directory = root) {
  const files = readdirSync(directory, { withFileTypes: true }).filter(item => item.isFile()).map(item => item.name);
  const errors = [];
  let scripts = 0;
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    try { new vm.Script(source, { filename: file }); scripts++; } catch (error) { errors.push(error.message); }
    if (file !== 'auth.js' && /sessionStorage\.(?:getItem|setItem)|\bpass\s*:\s*["']admin["']|[?&](?:password|pass)=/.test(source)) {
      errors.push(`${file}: legacy credential authentication must not return`);
    }
  }
  for (const file of files.filter(file => file.endsWith('.html'))) {
    const source = readFileSync(path.join(directory, file), 'utf8');
    const tags = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];
    const auth = tags.findIndex(tag => /\bsrc=["']auth\.js["']/.test(tag[0]));
    if (auth !== 0 || tags.filter(tag => /\bsrc=["']auth\.js["']/.test(tag[0])).length !== 1) {
      errors.push(`${file}: load auth.js exactly once before other scripts`);
    }
    for (const tag of tags) if (tag[1].trim()) {
      try { new vm.Script(tag[1], { filename: `${file}:inline` }); } catch (error) { errors.push(error.message); }
    }
    for (const match of source.matchAll(/<(script|link|img|source)\b[^>]*?\b(src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const relative = match[3].split(/[?#]/)[0];
      if (!relative || /^(https?:|data:|\/\/)/i.test(relative) || relative.includes('${')) continue;
      if (!existsSync(path.join(directory, relative.replace(/^\//, '')))) errors.push(`${file}: missing ${relative}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { scripts, pages: files.filter(file => file.endsWith('.html')).length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateStatic();
  console.log(`Validated ${result.scripts} browser scripts, ${result.pages} pages and their local assets.`);
}
