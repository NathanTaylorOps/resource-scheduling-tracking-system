import assert from 'node:assert/strict';
import { recordSessionCreation } from '../session-rate-limit';
import { isValidSessionId } from '../session';

const windowMs = 1000;
const buckets = new Map<string, number[]>();
assert.equal(recordSessionCreation(buckets, 'first', 100, 2, windowMs), true);
assert.equal(recordSessionCreation(buckets, 'first', 200, 2, windowMs), true);
assert.equal(recordSessionCreation(buckets, 'first', 300, 2, windowMs), false, 'third session must be refused');
assert.equal(buckets.get('first')?.length, 2, 'refused requests must not consume new slots');
assert.equal(recordSessionCreation(buckets, 'second', 1200, 2, windowMs), true);
assert.equal(buckets.has('first'), false, 'expired IP entries must not accumulate');
assert.equal(recordSessionCreation(buckets, 'first', 1300, 2, windowMs), true, 'expired window must reset');

for (const malformed of ['', '../../db', '00000000-0000-0000-0000-000000000000/../', 'some-cookie']) {
  assert.equal(isValidSessionId(malformed), false);
}
assert.equal(isValidSessionId('123e4567-e89b-12d3-a456-426614174000'), true);
console.log('PASS session rate limit expiry, denial, reset and identifier validation');
