await import('./auth-context-check.mjs');
await import('./auth-email-quality-check.mjs');

console.log(JSON.stringify({
  ok: true,
  aggregate: 'auth-quality-check',
  checks: 61,
}, null, 2));
