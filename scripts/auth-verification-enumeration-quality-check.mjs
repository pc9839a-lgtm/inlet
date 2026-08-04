import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { issueEmailVerificationToken } from '../functions/api/auth/_auth.js';

const authSource = await fs.readFile(new URL('../functions/api/auth/_auth.js', import.meta.url), 'utf8');
const routeSource = await fs.readFile(new URL('../functions/api/auth/email-verification.js', import.meta.url), 'utf8');

assert.doesNotMatch(authSource, /purpose === 'signup'[\s\S]{0,160}AUTH_EMAIL_DUPLICATE/);
assert.doesNotMatch(routeSource, /purpose === 'email-change'[\s\S]{0,180}AUTH_EMAIL_DUPLICATE/);
assert.match(routeSource, /suppressPasswordResetDelivery/);
assert.match(routeSource, /concealDeliveryFailure: purpose === 'password-reset'/);
assert.match(routeSource, /ensureMinimumResponseTime\(responseStartedAt, 650\)/);
assert.match(routeSource, /delivery: \{ mode: 'api', status: 'accepted' \}/);
assert.match(authSource, /const suppressDelivery = input\.suppressDelivery === true/);
assert.match(authSource, /const concealDeliveryFailure = input\.concealDeliveryFailure === true/);
assert.match(authSource, /if \(suppressDelivery\)/);
assert.match(authSource, /if \(concealDeliveryFailure\)/);
assert.match(authSource, /if \(await getD1AccountByEmail\(env\.DB, email\)\) throw authError\('Email is already registered\.'/);

const env = {
  INLET_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  INLET_AUTH_EMAIL_MODE: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
};

const suppressed = await issueEmailVerificationToken({
  email: 'missing-account@example.com',
  purpose: 'password-reset',
  suppressDelivery: true,
  concealDeliveryFailure: true,
}, env);
assert.equal(suppressed.status, 'pending');
assert.equal(suppressed.purpose, 'password-reset');
assert.deepEqual(suppressed.delivery, { mode: 'api', status: 'accepted' });
assert.equal(Object.hasOwn(suppressed, 'token'), false);

const signup = await issueEmailVerificationToken({
  email: 'existing-signup@example.com',
  purpose: 'signup',
}, env);
assert.equal(signup.status, 'pending');
assert.equal(signup.purpose, 'signup');
assert.equal(typeof signup.token, 'string');

console.log(JSON.stringify({ ok: true, checks: 16 }, null, 2));
