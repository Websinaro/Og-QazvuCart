import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  notifications,
  adminNotifications,
  deviceTokens,
  users,
  NotificationTarget,
} from '@/src/db/schema';
import { sendPushToTokens } from '@/src/lib/firebaseAdmin';

export interface SendBroadcastInput {
  sentBy: number;
  title: string;
  body: string;
  link?: string;
  target: NotificationTarget;
}

export class NotificationService {
  // ------------------------------------------------------------------
  // In-app notification center (per-user)
  // ------------------------------------------------------------------

  static async getForUser(userId: number, limit = 30) {
    return db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  static async getUnreadCount(userId: number): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return row?.count || 0;
  }

  static async markRead(userId: number, notificationId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  static async markAllRead(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  // ------------------------------------------------------------------
  // Device tokens (Firebase Cloud Messaging web push)
  // ------------------------------------------------------------------

  static async registerDeviceToken(userId: number, token: string) {
    // A token can only ever belong to one user at a time — if the same
    // browser previously registered under a different account (shared
    // computer, account switch), re-point it rather than erroring, then
    // touch last_seen_at so stale-token cleanup jobs can find truly dead
    // ones later.
    await db
      .insert(deviceTokens)
      .values({ userId, token })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId, lastSeenAt: new Date() },
      });
  }

  static async removeDeviceToken(token: string) {
    await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }

  // ------------------------------------------------------------------
  // Admin broadcast — creates the in-app rows AND attempts push delivery
  // ------------------------------------------------------------------

  static async sendBroadcast(input: SendBroadcastInput) {
    const targetRoles =
      input.target === 'CUSTOMERS' ? ['CUSTOMER'] : input.target === 'SELLERS' ? ['SELLER'] : null;

    const recipientRows = targetRoles
      ? await db.select({ id: users.id }).from(users).where(inArray(users.role, targetRoles))
      : await db.select({ id: users.id }).from(users);

    const recipientIds = recipientRows.map((r) => r.id);

    const [broadcast] = await db
      .insert(adminNotifications)
      .values({
        sentBy: input.sentBy,
        title: input.title,
        body: input.body,
        link: input.link || null,
        target: input.target,
        recipientCount: recipientIds.length,
      })
      .returning();

    if (recipientIds.length > 0) {
      // Batch insert in chunks to stay well under typical parameter limits
      // on very large user bases.
      const CHUNK = 500;
      for (let i = 0; i < recipientIds.length; i += CHUNK) {
        const chunk = recipientIds.slice(i, i + CHUNK);
        await db.insert(notifications).values(
          chunk.map((userId) => ({
            userId,
            adminNotificationId: broadcast.id,
            type: 'ADMIN' as const,
            title: input.title,
            body: input.body,
            link: input.link || null,
          }))
        );
      }
    }

    // Push delivery is best-effort: if Firebase isn't configured or a send
    // fails, the in-app notification rows above already exist, so nothing
    // is lost — the person just sees it in the bell instead of a push.
    let pushDelivered = 0;
    let pushFailed = 0;
    try {
      if (recipientIds.length > 0) {
        const tokenRows = await db
          .select({ token: deviceTokens.token })
          .from(deviceTokens)
          .where(inArray(deviceTokens.userId, recipientIds));
        const tokens = tokenRows.map((r) => r.token);

        if (tokens.length > 0) {
          const result = await sendPushToTokens(tokens, {
            title: input.title,
            body: input.body,
            link: input.link,
          });
          pushDelivered = result.delivered;
          pushFailed = result.failed;

          if (result.deadTokens.length > 0) {
            await db.delete(deviceTokens).where(inArray(deviceTokens.token, result.deadTokens));
          }
        }
      }
    } catch (err) {
      // Firebase not configured, or a transient send error — log and move
      // on; see comment above on why this doesn't roll back the broadcast.
      console.error('[NotificationService] push delivery failed:', err);
    }

    await db
      .update(adminNotifications)
      .set({ pushDeliveredCount: pushDelivered, pushFailedCount: pushFailed })
      .where(eq(adminNotifications.id, broadcast.id));

    return {
      id: broadcast.id,
      recipientCount: recipientIds.length,
      pushDelivered,
      pushFailed,
    };
  }

  static async getBroadcastHistory(limit = 30) {
    return db
      .select({
        id: adminNotifications.id,
        title: adminNotifications.title,
        body: adminNotifications.body,
        link: adminNotifications.link,
        target: adminNotifications.target,
        recipientCount: adminNotifications.recipientCount,
        pushDeliveredCount: adminNotifications.pushDeliveredCount,
        pushFailedCount: adminNotifications.pushFailedCount,
        createdAt: adminNotifications.createdAt,
        sentByUsername: users.username,
      })
      .from(adminNotifications)
      .leftJoin(users, eq(adminNotifications.sentBy, users.id))
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit);
  }
}
