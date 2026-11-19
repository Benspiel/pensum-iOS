import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAuthLink, callbackUrl } from '../src/account/links';
import { readSessionCookie } from '../src/account/session-cookie';
import { asPensumError, httpError, statusCode } from '../src/backend/errors';
import { projectId } from '../src/backend/config';

test('validates the full native Appwrite callback on cold start', () => {
  assert.deepEqual(parseAuthLink(`${callbackUrl('recover')}?userId=abc_23&secret=pensum.token`),
    { kind: 'recover', userId: 'abc_23', secret: 'pensum.token' });
  assert.deepEqual(parseAuthLink(`${callbackUrl('verify')}?userId=42&secret=verify-token`),
    { kind: 'verify', userId: '42', secret: 'verify-token' });
});

test('rejects links with another scheme, unrelated paths, or duplicate credentials', () => {
  for (const target of [
    'https://pensum-omega.vercel.app/auth/recover?userId=abc&secret=wrong',
    'pensum://auth/recover?userId=abc&secret=wrong',
    `${callbackUrl('recover')}?userId=abc&secret=one&secret=two`,
    `${callbackUrl('recover')}?userId=abc&secret=x#fragment`,
    `${callbackUrl('recover')}?userId=%2Fabc&secret=one`,
    `${callbackUrl('verify')}?userId=abc`,
    `${callbackUrl('verify')}/other?userId=abc&secret=one`,
  ]) assert.equal(parseAuthLink(target), null);
});

test('uses the callback-specific nonce for OAuth success and failure', () => {
  const url = callbackUrl('oauth');
  const nonce = '97c76639-8aaf-4109-aadd-2e1e62b7ab5d';
  assert.deepEqual(parseAuthLink(`${url}?nonce=${nonce}&userId=test-user&secret=one.two.three`), {
    kind: 'oauth', nonce, userId: 'test-user', secret: 'one.two.three',
  });
  assert.deepEqual(parseAuthLink(`${url}?nonce=${nonce}&failed=1&message=${encodeURIComponent('test message')}`),
    { kind: 'oauth-failure', nonce });
  assert.equal(parseAuthLink(`${url}?userId=test-user&secret=test-token`), null);
  assert.equal(parseAuthLink(`${url}?nonce=${nonce}&nonce=${nonce}&failed=1`), null);
});

test('accepts only the selected project session cookie from Appwrite fallback headers', () => {
  const cookie = 'ZXhhbXBsZQ==';
  assert.equal(readSessionCookie(projectId, JSON.stringify({
    a_session_different_project: 'other',
    [`a_session_${projectId}`]: cookie,
  })), cookie);
  for (const header of [
    null, '{', '[]', '{}', '{"a_session_different_project":"other"}',
    JSON.stringify({ [`a_session_${projectId}`]: [] }),
    JSON.stringify({ [`a_session_${projectId}`]: 'bad value' }),
  ]) assert.equal(readSessionCookie(projectId, header), null);
});

test('keeps backend authorization, rate limit, and offline failures distinct', () => {
  const forbidden = httpError(403, 'Kein Teamzugang');
  assert.equal(forbidden.code, 'forbidden');
  assert.equal(forbidden.message, 'Kein Teamzugang');
  assert.equal(statusCode(forbidden), 403);
  assert.equal(asPensumError({ code: 429 }).code, 'rate-limit');
  assert.equal(asPensumError(new TypeError('Network request failed')).code, 'offline');
  assert.equal(asPensumError(new Error('ordinary failure')).code, 'unknown');
});
