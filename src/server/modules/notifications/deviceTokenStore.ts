import { and, eq } from 'drizzle-orm';
import { deviceTokens } from '../../../db/schema';

/** The slice of a drizzle client this needs, so tests can inject a fake. */
export interface DeviceTokenDeleteClient {
  delete(table: typeof deviceTokens): { where(condition: ReturnType<typeof and>): PromiseLike<unknown> };
}

/**
 * Unregisters a device token ONLY if it belongs to `userId`. Matching on the
 * token alone would let any logged-in user remove someone else's token.
 * A non-matching token is a silent no-op (same outcome as an unknown token).
 */
export async function removeOwnedDeviceToken(client: DeviceTokenDeleteClient, userId: number, token: string) {
  await client
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)));
}
