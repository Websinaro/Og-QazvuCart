/**
 * Pure (no DB / env) rules for admin access to seller data, kept separate so
 * they can be unit-tested and imported anywhere.
 */

/** Distinct, grantable admin permissions. Not implied by the ADMIN role. */
export const ADMIN_PERMISSIONS = {
  SELLER_PAYOUT_DETAILS_WRITE: 'seller_payout_details:write',
} as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Admin "view as seller" may only perform these. Unknown/missing methods fail closed. */
export function isReadOnlyMethod(method: string | null | undefined): boolean {
  return READ_ONLY_METHODS.has((method ?? '').toUpperCase());
}

/** Wrong step-up passwords allowed per admin inside the window before they are locked out. */
export const STEP_UP_MAX_FAILURES = 5;
export const STEP_UP_WINDOW_MINUTES = 15;
export function isStepUpLocked(recentFailures: number): boolean {
  return recentFailures >= STEP_UP_MAX_FAILURES;
}

/** Every sensitive admin change must carry a human-written justification. */
export const MIN_AUDIT_REASON_LENGTH = 10;

const PAYOUT_FIELDS = ['accountHolder', 'bankName', 'ifsc', 'accountNumber', 'upiId'] as const;

/** Names (never values) of the payout fields a change touches, for the audit log. */
export function changedPayoutFields(input: Record<string, unknown>): string[] {
  return PAYOUT_FIELDS.filter((k) => input[k] !== undefined);
}
