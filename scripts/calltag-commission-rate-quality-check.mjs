import assert from 'node:assert/strict';
import { resolveCallTagCommissionRateBps } from '../functions/api/billing/_commissions.js';

// This is a pure policy test. Payment/settlement E2E remains a separate release gate.
assert.equal(resolveCallTagCommissionRateBps(), 2000, 'missing config defaults to 20%');
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: 2000 }), 2000);
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: 5000 }), 5000);
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: 0 }), 0,
  'disabled 0% must not silently become 20%');
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: '0' }), 0);
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: 5001 }), 2000);
assert.equal(resolveCallTagCommissionRateBps({ commissionRateBps: 'invalid' }), 2000);
console.log('CallTag configurable commission rate contract: PASS (including 0%)');
