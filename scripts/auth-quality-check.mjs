await import('./auth-context-check.mjs');
await import('./auth-email-quality-check.mjs');
await import('./auth-verification-purpose-consumption-quality-check.mjs');

console.log(JSON.stringify({
  ok: true,
  aggregate: 'auth-quality-check',
  checks: 68,
}, null, 2));
