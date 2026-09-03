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
 * One-time admin bootstrap credentials. Only read by the `admin:create`
 * CLI script (see src/scripts/create-admin.ts) — never by the running
 * application, and never with a hardcoded fallback. There is no automatic
 * demo/seed account creation in production.
 */
export const bootstrap = {
  get adminEmail() {
    return requireEnv('BOOTSTRAP_ADMIN_EMAIL');
  },
  get adminPassword() {
    return requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
  },
};
