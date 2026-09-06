'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, MessagePayload } from 'firebase/messaging';

/**
 * All six values below are Firebase's *public* web config — safe to ship
 * in the client bundle by design (this is how every Firebase web app is
 * configured). What actually gates access is Firebase Auth/security rules
 * and, here, the VAPID key pairing for push — none of that is exposed.
 * See .env.example for where these come from in the Firebase console.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId);
}

let cachedApp: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

/** True if this browser can receive Web Push at all (Safari < 16, some in-app browsers can't). */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export type PushRequestFailureReason =
  | 'unsupported'
  | 'not_configured'
  | 'permission_denied'
  | 'registration_failed';

export interface PushRequestResult {
  token: string | null;
  reason?: PushRequestFailureReason;
}

/**
 * Prompts the browser's native permission dialog, registers the FCM
 * service worker, and returns a device token to send to the backend.
 * Never throws — every failure mode is reported via `reason` so the
 * calling UI can tell the person *why* (unsupported browser, missing
 * server config, permission denied, or a registration error) instead of
 * push notifications just silently not working.
 */
export async function requestPushPermissionAndToken(): Promise<PushRequestResult> {
  if (typeof window === 'undefined') return { token: null, reason: 'unsupported' };
  if (!isFirebaseConfigured()) return { token: null, reason: 'not_configured' };
  if (!(await isPushSupported())) return { token: null, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { token: null, reason: 'permission_denied' };

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    return token ? { token } : { token: null, reason: 'registration_failed' };
  } catch (err) {
    console.error('[firebaseClient] push permission/token request failed:', err);
    return { token: null, reason: 'registration_failed' };
  }
}

/**
 * Subscribes to messages that arrive while the tab is open and focused
 * (background/closed-tab pushes are handled by the service worker
 * instead). Returns an unsubscribe function.
 */
export function listenForForegroundMessages(callback: (payload: MessagePayload) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  isPushSupported().then((supported) => {
    if (!supported || cancelled) return;
    const messaging = getMessaging(getFirebaseApp());
    unsubscribe = onMessage(messaging, callback);
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}
