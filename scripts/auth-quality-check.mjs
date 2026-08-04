await import('./auth-context-check.mjs');
await import('./auth-email-quality-check.mjs');
await import('./auth-verification-purpose-consumption-quality-check.mjs');
await import('./auth-email-abuse-quality-check.mjs');
await import('./auth-login-abuse-quality-check.mjs');
await import('./auth-verification-enumeration-quality-check.mjs');
await import('./auth-session-revocation-quality-check.mjs');

console.log(JSON.stringify({
  ok: true,
  aggregate: 'auth-quality-check',
  checks: 136,
}, null, 2));
