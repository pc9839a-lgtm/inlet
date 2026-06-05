import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'server', 'functions'];
const extensions = new Set(['.js', '.jsx', '.mjs', '.css', '.html']);
const ignoredFiles = new Set([
  'src/styles/base-wayzi-footer.css',
]);

const mojibakePatterns = [
  { name: 'replacement-character', pattern: /\uFFFD/ },
  { name: 'common-mojibake-cjk', pattern: /[癰揶獄筌沃珥沅愿寃]/ },
  { name: 'compat-cjk-mojibake', pattern: /[留硫吏罹理醫]/ },
  { name: 'broken-hangul-question-prefix', pattern: /\?[ㄱ-ㅎ가-힣]/ },
  { name: 'broken-japanese-close-label', pattern: /リ린/ },
  { name: 'broken-middle-dot', pattern: /쨌/ },
  { name: 'known-broken-submit-labels', pattern: /덉빟|묒닔|꾩넚|뺤씤|섏씠|대찓|곕씫|몃룞|뚯뒪|/ },
  { name: 'server-operator-mojibake-cjk', pattern: /諛|獄|揆|珥|吏|遺|誘몃|蹂몄|媛|윭|뙣|쒓컙|몄쬆|留뚮즺|臾댁/ },
  { name: 'broken-question-korean-prefix', pattern: /\?(?:묒|곹|대|몃|덉|쒓|꾩|낅|듬||뚯)/ },
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
    mojibakePatterns.forEach(({ name, pattern }) => {
      if (pattern.test(line)) {
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
