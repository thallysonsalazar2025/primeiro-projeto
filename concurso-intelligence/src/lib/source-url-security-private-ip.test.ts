import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicHttpUrl } from './source-url-security.ts';

test('rejeita IPv4 privado representado como IPv6 mapeado em hexadecimal', () => {
  assert.throws(
    () => validatePublicHttpUrl('https://[::ffff:7f00:1]/questions.json', 'source.url'),
    /host local ou privado/,
  );

  assert.throws(
    () => validatePublicHttpUrl('https://[::ffff:c0a8:101]/questions.json', 'source.url'),
    /host local ou privado/,
  );
});

test('mantém IPv4 público mapeado em IPv6 permitido', () => {
  const parsed = validatePublicHttpUrl('https://[::ffff:808:808]/questions.json', 'source.url');
  assert.equal(parsed.hostname, '[::ffff:808:808]');
});

test('rejeita IPv4 privado encapsulado no prefixo NAT64 bem conhecido', () => {
  assert.throws(
    () => validatePublicHttpUrl('https://[64:ff9b::7f00:1]/questions.json', 'source.url'),
    /host local ou privado/,
  );

  assert.throws(
    () => validatePublicHttpUrl('https://[64:ff9b::c0a8:101]/questions.json', 'source.url'),
    /host local ou privado/,
  );
});

test('bloqueia o prefixo NAT64 de uso local e mantém NAT64 público permitido', () => {
  assert.throws(
    () => validatePublicHttpUrl('https://[64:ff9b:1::808:808]/questions.json', 'source.url'),
    /host local ou privado/,
  );

  const parsed = validatePublicHttpUrl('https://[64:ff9b::808:808]/questions.json', 'source.url');
  assert.equal(parsed.hostname, '[64:ff9b::808:808]');
});
