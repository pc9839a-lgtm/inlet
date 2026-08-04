from pathlib import Path

path = Path('scripts/auth-email-quality-check.mjs')
text = path.read_text(encoding='utf-8')
old = """            async run() {
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) {
"""
new = """            async run() {
              if (normalized.startsWith(\"UPDATE auth_email_verifications SET status = 'superseded'\")) {
                const [email, purpose] = args;
                for (const row of rows) {
                  if (row.email === email && row.purpose === purpose && ['pending', 'confirmed'].includes(row.status)) {
                    row.status = 'superseded';
                  }
                }
                return { success: true };
              }
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) {
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one SES verification DB insertion point, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Updated SES auth email QA fixture for same-purpose verification supersession.')
