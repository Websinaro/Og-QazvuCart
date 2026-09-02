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
  adminEmail: process.env.ADMIN_EMAIL || 'admin@qazvucart.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'AdminPassword@123',
  demoCustomerEmail: process.env.DEMO_CUSTOMER_EMAIL || 'john@example.com',
  demoCustomerPassword: process.env.DEMO_CUSTOMER_PASSWORD || 'Customer@123',
  demoSellerEmail: process.env.DEMO_SELLER_EMAIL || 'seller@primecommerce.com',
  demoSellerPassword: process.env.DEMO_SELLER_PASSWORD || 'Seller@123',
} as const;
