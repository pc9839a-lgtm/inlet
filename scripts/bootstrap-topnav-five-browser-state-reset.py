from pathlib import Path

path = Path('scripts/landing-browser-regression-check.mjs')
text = path.read_text(encoding='utf-8')
old = """        results.push({ scenario: 'five-menu-left', viewport: viewport.name, file: fiveMenuFile, data: fiveMenu });
      }
"""
new = """        results.push({ scenario: 'five-menu-left', viewport: viewport.name, file: fiveMenuFile, data: fiveMenu });
        await evaluate(client, storageScript(7));
      }
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one five-menu scenario end, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

contract_path = Path('scripts/landing-browser-regression-contract-check.mjs')
contract = contract_path.read_text(encoding='utf-8')
needle = "assert(visual.includes('assertFiveMenuLeftAligned') && visual.includes('menu 4 must align with menu 1') && visual.includes('menu 5 must align with menu 2'), 'five-menu browser QA must compare real x coordinates');\n"
addition = needle + "assert(visual.includes('await evaluate(client, storageScript(7));'), 'five-menu browser QA must restore the seven-menu baseline before the next viewport');\n"
if contract.count(needle) != 1:
    raise SystemExit('browser contract state-reset insertion point missing')
contract_path.write_text(contract.replace(needle, addition, 1), encoding='utf-8')
print('Restored seven-menu browser baseline after the five-menu coordinate scenario.')
