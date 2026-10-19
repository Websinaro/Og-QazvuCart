/**
 * Centralized environment configuration.
 *
 * Hard rule: secrets have NO hardcoded fallback values. If a required secret
 * is missing, the process throws at startup (fail fast) instead of silently
 * running with a well-known, guessable default.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} is required. Set it in your environment (see .env.example) before starting the server.`
    );
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return requireEnv('DATABASE_URL');
  },
  get JWT_SECRET() {
    return requireEnv('JWT_SECRET');
  },
  get JWT_REFRESH_SECRET() {
    return requireEnv('JWT_REFRESH_SECRET');
  },
};

/**
 * Razorpay TEST MODE credentials. Lazy getters so importing this module
 * never fails just because payments aren't configured yet in local dev —
 * only routes that actually create/verify a payment will throw, and only
 * at the moment they're invoked. The key SECRET and WEBHOOK secret must
 * never reach the browser; only `keyId` is ever sent to the client (see
 * app/api/payments/razorpay/create-order/route.ts).
 */
export const razorpayEnv = {
  get keyId() {
    return requireEnv('RAZORPAY_KEY_ID');
  },
  get keySecret() {
    return requireEnv('RAZORPAY_KEY_SECRET');
  },
  get webhookSecret() {
    return requireEnv('RAZORPAY_WEBHOOK_SECRET');
  },
};

/**
 * Firebase Admin SDK credentials — used server-side only, to send Web Push
 * notifications via FCM (see src/lib/firebaseAdmin.ts). Lazy getters, same
 * rationale as razorpayEnv: importing this module must never fail just
 * because push notifications aren't configured yet; only the send path
 * throws, and only when actually invoked. PRIVATE_KEY commonly arrives
 * from the hosting provider's env UI with literal "\n" sequences instead
 * of real newlines, so it's unescaped here rather than at every call site.
 */
export const firebaseAdminEnv = {
  get projectId() {
    return requireEnv('FIREBASE_PROJECT_ID');
  },
  get clientEmail() {
    return requireEnv('FIREBASE_CLIENT_EMAIL');
  },
  get privateKey() {
    return requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  },
};

export const config = {
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '30d',
  cookieName: 'marketplace_token',
  refreshCookieName: 'marketplace_refresh_token',
  appName: 'QazvuCart Multi-Vendor Marketplace',
  defaultCurrency: 'INR',
  defaultDeliveryFee: 40,
  freeDeliveryThreshold: 999,
} as const;

/**
 * Admin credentials (server-side only, never sent to the browser).
 *
 * Whoever signs up or signs in with EXACTLY this email AND this password
 * becomes (or is kept as) an ADMIN. Both values must be set for the
 * feature to be active; if either is missing nobody can obtain admin this
 * way. There is no hardcoded fallback. `ADMIN_USERNAME` is optional and is
 * only used as the username when the admin account is first created from
 * a login (signup uses the username typed in the form).
 *
 * The legacy BOOTSTRAP_ADMIN_* names are still honoured so existing
 * deployments keep working.
 */
function optionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value;
  }
  return undefined;
}

export const adminEnv = {
  get email(): string | undefined {
    return optionalEnv('ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_EMAIL')?.trim().toLowerCase();
  },
  get password(): string | undefined {
    return optionalEnv('ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_PASSWORD');
  },
  get username(): string | undefined {
    return optionalEnv('ADMIN_USERNAME')?.trim();
  },
};

/**
 * Credentials for the interactive `npm run admin:create` CLI. Kept for
 * backwards compatibility; the running application uses `adminEnv`.
 */
export const bootstrap = {
  get adminEmail() {
    return requireEnv('BOOTSTRAP_ADMIN_EMAIL');
  },
  get adminPassword() {
    return requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
  },
};
