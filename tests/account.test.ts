import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, validateUsername, validatePassword, authErrorMessage } from '../lib/account';
test('usernames are canonical and reject whitespace, email addresses, and path characters', () => {
  assert.equal(normalizeUsername('  Benjamin_45 '), 'benjamin_45');
  assert.equal(validateUsername('Benjamin_45'), null);
  for (const value of ['a','123user','a/b','user@email.test','user name','a'.repeat(31)]) assert.ok(validateUsername(value));
});
test('passwords require a useful length and are never silently trimmed', () => {
  assert.ok(validatePassword('short')); assert.ok(validatePassword('a'.repeat(129)));
  assert.equal(validatePassword(' a long password '), null);
});
test('account errors explain confirmation and limits without exposing service details', () => {
  assert.match(authErrorMessage('email_not_confirmed'), /Confirm your email/);
  assert.match(authErrorMessage('over_request_rate_limit'), /Too many attempts/);
  assert.match(authErrorMessage('unexpected-private-error'), /incorrect/);
  assert.match(authErrorMessage('unexpected-private-error', true), /Could not create/);
});
