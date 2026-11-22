import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERACTION_TYPES } from './authz';

test('case note interaction type offers exactly the seven agreed choices, in order', () => {
  assert.deepEqual([...INTERACTION_TYPES], [
    'Email',
    'Home visit',
    'Off-Site',
    'Office',
    'Phone',
    'Text/WhatsApp',
    'Virtual',
  ]);
});

test('interaction type list has no duplicates and no retired names', () => {
  assert.equal(new Set(INTERACTION_TYPES).size, INTERACTION_TYPES.length);
  for (const retired of ['Counselling Session', 'Telephone Call', 'Video Appointment', 'Follow-up', 'Referral', 'Outreach', 'Other']) {
    assert.equal((INTERACTION_TYPES as readonly string[]).includes(retired), false, `${retired} should no longer be offered`);
  }
});
