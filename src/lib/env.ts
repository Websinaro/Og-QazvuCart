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
  // Reserved for signing/verifying payment provider webhooks & payment
  // intents. Not exercised by the current (simulated) checkout flow, but
  // required upfront so a real payment integration never ships with a
  // hardcoded fallback secret.
  get PAYMENT_SECRET() {
    return requireEnv('PAYMENT_SECRET');
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
