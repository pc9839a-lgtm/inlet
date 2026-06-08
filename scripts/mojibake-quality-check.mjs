import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'server', 'functions'];
const extensions = new Set(['.js', '.jsx', '.mjs', '.css', '.html']);
const ignoredFiles = new Set([
  'src/styles/base-wayzi-footer.css',
]);

const mojibakePatterns = [
  { name: 'replacement-character', tokens: ['\uFFFD'] },
  { name: 'common-mojibake-cjk', tokens: ['亦', '筌', '野', '獄', '沃', '癰', '揶', '珥', '沅', '愿', '寃'] },
  { name: 'compat-cjk-mojibake', tokens: ['留', '硫', '吏', '罹', '理', '醫'] },
  { name: 'known-functions-mojibake', tokens: ['以묐났', '李⑤떒', '뺤콉', '섏뿀', '듬땲', '섏씠', '吏', '李얠', '덉슜', '붿껌', '諛⑹떇', '뚮┝', '꾩넚', 'ㅽ뙣', '곷떞', '덉빟'] },
  { name: 'known-broken-submit-labels', tokens: ['묒닔', '뺤씤', '대찓', '곕씫', '몃룞', '뚯뒪'] },
  { name: 'broken-label-fragments', tokens: ['る┛', '夷?', '쨌'] },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      files.push(...await collectFiles(file));
      continue;
    }
    if (extensions.has(path.extname(entry.name))) files.push(file);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...await collectFiles(root));
files.push('wrangler.jsonc');

const findings = [];
for (const file of files) {
  if (ignoredFiles.has(file)) continue;
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    mojibakePatterns.forEach(({ name, tokens }) => {
      if (tokens.some((token) => line.includes(token))) {
        findings.push({
          file,
          line: index + 1,
          type: name,
          text: line.trim().slice(0, 180),
        });
      }
    });
  });
}

assert(findings.length === 0, `mojibake text found:\n${findings.slice(0, 40).map((item) => `${item.file}:${item.line} ${item.type} ${item.text}`).join('\n')}`);

console.log(JSON.stringify({ ok: true, files: files.length, checks: mojibakePatterns.length }, null, 2));
