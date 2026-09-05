import { NextResponse } from 'next/server';

/**
 * The FCM service worker needs the same public Firebase config as the
 * client app to receive BACKGROUND pushes (tab not focused / closed). It
 * can't be a static file in /public because those aren't processed by
 * Next's env substitution — so it's served from a route instead, reading
 * process.env at request time. Same trick used for dynamic robots.txt /
 * sitemap.xml routes. Cached for a few minutes since the config rarely
 * changes and this is requested on every page load that registers push.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };

  const script = `
// Auto-generated at request time from server env — do not edit directly.
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

// Background push (tab not focused, or closed entirely). Foreground
// messages while the tab IS open are handled in firebaseClient.ts instead,
// via onMessage, so a visible tab doesn't also get a duplicate OS toast.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'QazvuCart';
  const body = payload.notification?.body || '';
  const link = payload.fcmOptions?.link || payload.data?.link || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(clients.openWindow(link));
});
`.trim();

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Service-Worker-Allowed': '/',
    },
  });
}
