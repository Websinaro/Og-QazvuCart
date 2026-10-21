import test from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { removeOwnedDeviceToken, type DeviceTokenDeleteClient } from '../src/server/modules/notifications/deviceTokenStore.ts';

/**
 * In-memory stand-in for the DB. It renders the real WHERE clause to SQL and
 * applies it to its rows, so the test fails if the delete is not scoped by
 * BOTH token and user_id.
 */
function fakeDb(rows: Array<{ userId: number; token: string }>) {
  const dialect = new PgDialect();
  const client: DeviceTokenDeleteClient = {
    delete: () => ({
      where: async (condition) => {
        const { sql, params } = dialect.sqlToQuery(condition!);
        const conds = [...sql.matchAll(/"([a-z_]+)" = \$(\d+)/g)].map((m) => ({
          column: m[1], value: params[Number(m[2]) - 1],
        }));
        const keep = rows.filter((r) => !conds.every((c) => (c.column === 'token' ? r.token : r.userId) === c.value));
        rows.splice(0, rows.length, ...keep);
      },
    }),
  };
  return { client, rows };
}

test('a user cannot remove another user\'s device token', async () => {
  const { client, rows } = fakeDb([{ userId: 1, token: 'tok-alice' }, { userId: 2, token: 'tok-bob' }]);
  await removeOwnedDeviceToken(client, 2, 'tok-alice');
  assert.deepEqual(rows.map((r) => r.token).sort(), ['tok-alice', 'tok-bob']);
});

test('a user can remove their own device token, leaving others intact', async () => {
  const { client, rows } = fakeDb([{ userId: 1, token: 'tok-alice' }, { userId: 2, token: 'tok-bob' }]);
  await removeOwnedDeviceToken(client, 1, 'tok-alice');
  assert.deepEqual(rows.map((r) => r.token), ['tok-bob']);
});

test('the delete condition always includes both token and user_id', async () => {
  let captured = '';
  const client: DeviceTokenDeleteClient = {
    delete: () => ({ where: async (c) => { captured = new PgDialect().sqlToQuery(c!).sql; } }),
  };
  await removeOwnedDeviceToken(client, 7, 'x');
  assert.match(captured, /"token" = \$\d/);
  assert.match(captured, /"user_id" = \$\d/);
});
                               
