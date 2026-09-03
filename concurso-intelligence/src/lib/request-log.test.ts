import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRequestLog } from './request-log.ts';

test('buildRequestLog keeps only correlation-safe request metadata', () => {
  const log = buildRequestLog({
    requestId: 'req-123',
    method: 'GET',
    pathname: '/api/ranking/estimate',
  });

  assert.deepEqual(log, {
    event: 'http_request',
    requestId: 'req-123',
    method: 'GET',
    pathname: '/api/ranking/estimate',
  });
  assert.equal('query' in log, false);
  assert.equal('headers' in log, false);
  assert.equal('body' in log, false);
});
