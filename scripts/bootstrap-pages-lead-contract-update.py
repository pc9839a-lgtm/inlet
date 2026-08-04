from pathlib import Path

path = Path('scripts/pages-functions-quality-check.mjs')
text = path.read_text(encoding='utf-8-sig')
old = "'meta: { source:', '중복 접수 정책', '접수는 저장됐지만 알림 전송에 실패했습니다.'"
new = "'meta: { source:', 'LEAD_DUPLICATE', 'contactDuplicate ? 409 : 429', '접수가 너무 빠르게 반복되었습니다.', '접수는 저장됐지만 알림 전송에 실패했습니다.'"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one Pages lead token block, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Updated Pages lead contract for duplicate and throttling responses.')
