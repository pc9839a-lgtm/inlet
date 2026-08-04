from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8-sig')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# Cloudflare Pages lead intake: legacy pages must not silently enable cookie blocking.
replace_once(
    'functions/api/leads.js',
    "function normalizeDuplicateSettings(page = {}) {\n  const source = page.leadDuplicateSettings || page.duplicateCollectionSettings || {};\n  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);\n  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1d');\n  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();\n  return {\n    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),\n    rejectCookieDuplicate: (source.rejectCookieDuplicate ?? source.cookieDuplicateRejectEnabled ?? true) !== false,\n    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 3)),\n    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(windowKey)\n      ? windowKey\n      : '1d',\n    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',\n  };\n}\n",
    "export function normalizeDuplicateSettings(page = {}) {\n  const source = page.leadDuplicateSettings || page.duplicateCollectionSettings || {};\n  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);\n  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1d');\n  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();\n  const cookiePolicyExplicit = source.cookieDuplicatePolicyExplicit === true || Number(source.duplicatePolicyVersion || 0) >= 2;\n  return {\n    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),\n    rejectCookieDuplicate: cookiePolicyExplicit && source.rejectCookieDuplicate === true,\n    cookieDuplicatePolicyExplicit: cookiePolicyExplicit,\n    duplicatePolicyVersion: cookiePolicyExplicit ? 2 : 1,\n    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 3)),\n    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(windowKey)\n      ? windowKey\n      : '1d',\n    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',\n  };\n}\n",
)

replace_once(
    'functions/api/leads.js',
    "        return publicPostJsonResponse(request, env, 429, {\n          ok: false,\n          code: 'LEAD_RATE_LIMITED',\n          reason: duplicatePolicy.reason,\n          message: '중복 접수 정책에 따라 이번 접수는 차단되었습니다.',\n          retryAfter: 60,\n        });",
    "        const contactDuplicate = ['phone_duplicate', 'email_duplicate'].includes(String(duplicatePolicy.reason || ''));\n        return publicPostJsonResponse(request, env, contactDuplicate ? 409 : 429, {\n          ok: false,\n          code: contactDuplicate ? 'LEAD_DUPLICATE' : 'LEAD_RATE_LIMITED',\n          reason: duplicatePolicy.reason,\n          message: contactDuplicate\n            ? '이미 접수된 연락처입니다.'\n            : '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.',\n          retryAfter: Number(duplicatePolicy.retryAfter || 60),\n        });",
)

# Local/server parity for duplicate defaults and status semantics.
replace_once(
    'server/index.mjs',
    "function normalizeLeadDuplicateSettings(settings = {}) {\n  const source = settings && typeof settings === 'object' ? settings : {};\n  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);\n  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();\n  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1mo').trim();\n  return {\n    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),\n    rejectCookieDuplicate: source.rejectCookieDuplicate ?? source.cookieDuplicateRejectEnabled ?? false ? true : false,\n    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 1)),\n    formDuplicateLimitWindow: windowKey,\n    formDuplicateLimitMs: duplicatePolicyWindowMs(windowKey),\n    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',\n  };\n}\n",
    "function normalizeLeadDuplicateSettings(settings = {}) {\n  const source = settings && typeof settings === 'object' ? settings : {};\n  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);\n  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();\n  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1mo').trim();\n  const cookiePolicyExplicit = source.cookieDuplicatePolicyExplicit === true || Number(source.duplicatePolicyVersion || 0) >= 2;\n  return {\n    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),\n    rejectCookieDuplicate: cookiePolicyExplicit && source.rejectCookieDuplicate === true,\n    cookieDuplicatePolicyExplicit: cookiePolicyExplicit,\n    duplicatePolicyVersion: cookiePolicyExplicit ? 2 : 1,\n    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 1)),\n    formDuplicateLimitWindow: windowKey,\n    formDuplicateLimitMs: duplicatePolicyWindowMs(windowKey),\n    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',\n  };\n}\n",
)

replace_once(
    'server/index.mjs',
    "function leadRateLimitError(policy = {}) {\n  const error = new Error('Too many lead submissions. Please retry later.');\n  error.status = 429;\n  error.details = { code: 'LEAD_RATE_LIMITED', reason: policy.reason || 'rate_limited', retryAfter: policy.retryAfter || 60 };\n  return error;\n}\n",
    "function leadRateLimitError(policy = {}) {\n  const reason = String(policy.reason || 'rate_limited');\n  const contactDuplicate = ['phone_duplicate', 'email_duplicate'].includes(reason);\n  const error = new Error(contactDuplicate\n    ? '이미 접수된 연락처입니다.'\n    : '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.');\n  error.status = contactDuplicate ? 409 : 429;\n  error.details = {\n    code: contactDuplicate ? 'LEAD_DUPLICATE' : 'LEAD_RATE_LIMITED',\n    reason,\n    retryAfter: policy.retryAfter || 60,\n  };\n  return error;\n}\n",
)

# Inbox policy UI: legacy implicit true becomes off; only a deliberate toggle enables it.
replace_once(
    'src/panels/inbox/DuplicatePolicyPanel.jsx',
    "  const phoneEmailMode = String(source.phoneEmailMode || 'mark');\n  return {\n    rejectIpDuplicate: !!source.rejectIpDuplicate,\n    rejectCookieDuplicate: source.rejectCookieDuplicate !== false,\n    formDuplicateLimitCount: ['1', '2', '3', '5'].includes(count) ? count : '3',",
    "  const phoneEmailMode = String(source.phoneEmailMode || 'mark');\n  const cookiePolicyExplicit = source.cookieDuplicatePolicyExplicit === true || Number(source.duplicatePolicyVersion || 0) >= 2;\n  return {\n    rejectIpDuplicate: !!source.rejectIpDuplicate,\n    rejectCookieDuplicate: cookiePolicyExplicit && source.rejectCookieDuplicate === true,\n    cookieDuplicatePolicyExplicit: cookiePolicyExplicit,\n    duplicatePolicyVersion: cookiePolicyExplicit ? 2 : 1,\n    formDuplicateLimitCount: ['1', '2', '3', '5'].includes(count) ? count : '3',",
)

replace_once(
    'src/panels/inbox/DuplicatePolicyPanel.jsx',
    "            <DuplicatePolicySwitch label=\"쿠키 중복 차단\" checked={settings.rejectCookieDuplicate} onChange={(value) => save({ rejectCookieDuplicate: value })} />",
    "            <DuplicatePolicySwitch label=\"쿠키 중복 차단\" checked={settings.rejectCookieDuplicate} onChange={(value) => save({ rejectCookieDuplicate: value, cookieDuplicatePolicyExplicit: true, duplicatePolicyVersion: 2 })} />",
)

# Public form must distinguish a real duplicate from anti-spam throttling.
replace_once(
    'src/preview/renderers/FormBlocks.jsx',
    "    } catch (error) {\n      const isDuplicate = [409, 429].includes(Number(error?.status || 0));\n      setNotice({\n        tone: 'error',\n        message: isDuplicate ? '이미 접수된 정보입니다. 다른 연락처로 다시 시도해주세요.' : '접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요.',\n      });",
    "    } catch (error) {\n      const status = Number(error?.status || 0);\n      setNotice({\n        tone: 'error',\n        message: status === 409\n          ? '이미 접수된 연락처입니다. 입력한 연락처를 확인해주세요.'\n          : status === 429\n            ? '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.'\n            : '접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요.',\n      });",
)

# Focused regression contract exercises the exact default and migration behavior.
contract_path = Path('scripts/form-reservation-browser-regression-contract-check.mjs')
contract = contract_path.read_text(encoding='utf-8')
contract = contract.replace(
    "const packageJson = JSON.parse(await readFile('package.json', 'utf8'));\n",
    "const packageJson = JSON.parse(await readFile('package.json', 'utf8'));\nconst leadApiSource = await readFile('functions/api/leads.js', 'utf8');\nconst duplicatePanelSource = await readFile('src/panels/inbox/DuplicatePolicyPanel.jsx', 'utf8');\nconst formBlocksSource = await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8');\nconst { normalizeDuplicateSettings } = await import('../functions/api/leads.js');\n\nconst defaultDuplicateSettings = normalizeDuplicateSettings({});\nconst legacyImplicitCookieSettings = normalizeDuplicateSettings({ leadDuplicateSettings: { rejectCookieDuplicate: true } });\nconst explicitCookieSettings = normalizeDuplicateSettings({\n  leadDuplicateSettings: {\n    rejectCookieDuplicate: true,\n    cookieDuplicatePolicyExplicit: true,\n    duplicatePolicyVersion: 2,\n  },\n});\n",
    1,
)
contract = contract.replace(
    "assert(!browserSource.includes('pagero.kr/api/leads') && !browserSource.includes('productionPassword'), 'form browser QA must not use production data or credentials');\n",
    "assert(!browserSource.includes('pagero.kr/api/leads') && !browserSource.includes('productionPassword'), 'form browser QA must not use production data or credentials');\nassert(defaultDuplicateSettings.rejectCookieDuplicate === false, 'cookie duplicate blocking must default to off');\nassert(legacyImplicitCookieSettings.rejectCookieDuplicate === false, 'legacy implicit cookie blocking must migrate to off');\nassert(explicitCookieSettings.rejectCookieDuplicate === true, 'an explicit cookie duplicate toggle must remain enabled');\nassert(leadApiSource.includes(\"contactDuplicate ? 409 : 429\") && leadApiSource.includes(\"code: contactDuplicate ? 'LEAD_DUPLICATE' : 'LEAD_RATE_LIMITED'\"), 'lead API must distinguish duplicates from throttling');\nassert(duplicatePanelSource.includes('cookieDuplicatePolicyExplicit: true') && duplicatePanelSource.includes('duplicatePolicyVersion: 2'), 'inbox policy toggle must persist an explicit cookie setting');\nassert(formBlocksSource.includes('status === 409') && formBlocksSource.includes('status === 429') && !formBlocksSource.includes(\"[409, 429].includes\"), 'public form must show separate duplicate and rate-limit messages');\n",
    1,
)
contract = contract.replace(
    "  flows: ['consultation', 'consultation-duplicate', 'reservation', 'reservation-duplicate', 'inbox-reflection'],",
    "  flows: ['consultation', 'unique-contact-default', 'consultation-duplicate', 'reservation', 'reservation-duplicate', 'inbox-reflection'],",
    1,
)
contract_path.write_text(contract, encoding='utf-8')

print('Applied lead cookie duplicate default and error classification patch.')
