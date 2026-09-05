import 'server-only';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { firebaseAdminEnv } from '@/src/lib/env';

/**
 * Lazily initializes the Firebase Admin app on first use, not at import
 * time — same "fail only when actually needed" rationale as the rest of
 * this project's third-party integrations (see razorpayEnv). A server
 * that never sends a push notification never needs Firebase credentials
 * configured at all.
 */
let app: App | null = null;

function getFirebaseAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: firebaseAdminEnv.projectId,
      clientEmail: firebaseAdminEnv.clientEmail,
      privateKey: firebaseAdminEnv.privateKey,
    }),
  });
  return app;
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

export interface PushSendResult {
  delivered: number;
  failed: number;
  /** Tokens Firebase reported as no-longer-valid — caller should delete these from device_tokens. */
  deadTokens: string[];
}

const MAX_TOKENS_PER_BATCH = 500; // FCM's sendEachForMulticast hard limit.

/**
 * Sends a web push notification to a batch of FCM registration tokens.
 * Splits into chunks of 500 (FCM's limit per multicast call) and
 * aggregates delivered/failed counts plus which tokens are dead
 * (unregistered/invalid) so the caller can prune device_tokens.
 */
export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<PushSendResult> {
  if (tokens.length === 0) return { delivered: 0, failed: 0, deadTokens: [] };

  const messaging = getMessaging(getFirebaseAdminApp());
  const result: PushSendResult = { delivered: 0, failed: 0, deadTokens: [] };

  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
    const batch = tokens.slice(i, i + MAX_TOKENS_PER_BATCH);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
        },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
      },
    });

    result.delivered += response.successCount;
    result.failed += response.failureCount;

    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          result.deadTokens.push(batch[idx]);
        }
      }
    });
  }

  return result;
}
