from pathlib import Path

path = Path(__file__).with_name('bootstrap-auth-email-abuse-rate-limit.py')
if path.exists():
    text = path.read_text(encoding='utf-8')
    updated = text.replace("'  checks: 68,'", "'  checks: 78,'").replace("'  checks: 86,'", "'  checks: 96,'")
    if updated != text:
        path.write_text(updated, encoding='utf-8')
