from pathlib import Path

path = Path('scripts/server-smoke-leads.mjs')
text = path.read_text(encoding='utf-8-sig')

marker = """  assert(rateLimited.res.status === 429 && rateLimited.data.code === 'LEAD_RATE_LIMITED', 'same IP 4th submission in 1 minute should be rate limited');

  const policyProject = { projectId: 'smoke-leads-policy', slug: 'smoke-policy' };
"""
addition = """  assert(rateLimited.res.status === 429 && rateLimited.data.code === 'LEAD_RATE_LIMITED', 'same IP 4th submission in 1 minute should be rate limited');

  const legacyCookieProject = { projectId: 'smoke-leads-legacy-cookie', slug: 'smoke-legacy-cookie' };
  const legacyCookiePage = {
    ...page,
    slug: legacyCookieProject.slug,
    leadDuplicateSettings: {
      rejectIpDuplicate: false,
      rejectCookieDuplicate: true,
      formDuplicateLimitCount: 1,
      formDuplicateLimitWindow: '1mo',
      phoneEmailMode: 'mark',
    },
  };
  const legacyCookieSeed = await json({ baseUrl }, 'POST', '/api/leads', {
    project: legacyCookieProject,
    page: legacyCookiePage,
    lead: { id: 'legacy-cookie-seed', type: 'consult', status: 'new', name: 'Legacy Cookie Seed', phone: '010-7777-9001', clientId: 'legacy-cookie-client', ipHash: 'ip-legacy-cookie-a', createdAt: '2026-05-21T03:00:00.000Z' },
  });
  assert(legacyCookieSeed.res.ok, 'legacy cookie seed lead should save');
  const legacyCookieUniqueContact = await json({ baseUrl }, 'POST', '/api/leads', {
    project: legacyCookieProject,
    page: legacyCookiePage,
    lead: { id: 'legacy-cookie-unique', type: 'consult', status: 'new', name: 'Legacy Cookie Unique', phone: '010-7777-9002', clientId: 'legacy-cookie-client', ipHash: 'ip-legacy-cookie-b', createdAt: '2026-05-21T03:00:04.000Z' },
  });
  assert(legacyCookieUniqueContact.res.ok, 'a new contact from the same browser must not be blocked by a legacy implicit cookie setting');

  const policyProject = { projectId: 'smoke-leads-policy', slug: 'smoke-policy' };
"""
if text.count(marker) != 1:
    raise SystemExit(f'expected one rate-limit marker, found {text.count(marker)}')
text = text.replace(marker, addition, 1)

old_settings = """      rejectIpDuplicate: true,
      rejectCookieDuplicate: true,
      formDuplicateLimitCount: 1,
"""
new_settings = """      rejectIpDuplicate: true,
      rejectCookieDuplicate: true,
      cookieDuplicatePolicyExplicit: true,
      duplicatePolicyVersion: 2,
      formDuplicateLimitCount: 1,
"""
if text.count(old_settings) != 1:
    raise SystemExit(f'expected one explicit policy settings block, found {text.count(old_settings)}')
text = text.replace(old_settings, new_settings, 1)

old_assertion = """  assert(policyBlocked.res.status === 429 && policyBlocked.data.code === 'LEAD_RATE_LIMITED', 'settings should block configured duplicate lead');
  assert(['phone_duplicate', 'client_duplicate_limit', 'ip_duplicate_limit'].includes(policyBlocked.data.reason), `unexpected policy block reason: ${policyBlocked.data.reason}`);
"""
new_assertion = """  assert(policyBlocked.res.status === 409 && policyBlocked.data.code === 'LEAD_DUPLICATE', 'explicit contact duplicate policy should return a duplicate response');
  assert(policyBlocked.data.reason === 'phone_duplicate', `unexpected policy block reason: ${policyBlocked.data.reason}`);
"""
if text.count(old_assertion) != 1:
    raise SystemExit(f'expected one policy assertion block, found {text.count(old_assertion)}')
text = text.replace(old_assertion, new_assertion, 1)

path.write_text(text, encoding='utf-8')
print('Added unique-contact cookie regression and updated explicit duplicate contract.')
