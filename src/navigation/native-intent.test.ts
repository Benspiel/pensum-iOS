import assert from 'node:assert/strict';
import test from 'node:test';

import { redirectSystemPath } from '../../app/+native-intent';
import { appwriteCallbackScheme } from '../backend/config';

test('warm and cold Appwrite returns reach their screens without credentials in navigation', () => {
  for (const initial of [true, false]) {
    for (const kind of ['recover', 'verify', 'oauth']) {
      assert.equal(redirectSystemPath({
        path: appwriteCallbackScheme + '://auth/' + kind + '?secret=synthetic&userId=test&nonce=x',
        initial,
      }), '/auth/' + kind);
    }
  }
});

test('local auth navigation strips untrusted link parameters and other deep links keep their data', () => {
  assert.equal(redirectSystemPath({ path: 'pensum:///auth/verify?secret=synthetic', initial: true }), '/auth/verify');
  assert.equal(redirectSystemPath({ path: '/auth/recover?secret=synthetic', initial: false }), '/auth/recover');
  assert.equal(redirectSystemPath({
    path: appwriteCallbackScheme + '://unexpected?secret=synthetic',
    initial: true,
  }), '/konto');

  const target = 'pensum://tools/karteikarten?deck=synthetic';
  assert.equal(redirectSystemPath({ path: target, initial: true }), target);
});
