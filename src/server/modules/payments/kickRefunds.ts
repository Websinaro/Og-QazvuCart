/**
 * Fire-and-forget: after a transaction that queued refunds has committed,
 * push them to the gateway straight away instead of waiting for the next
 * maintenance run. Failure is harmless — rows stay PENDING and the retry
 * sweep (POST /api/internal/payments/maintenance) picks them up.
 *
 * Imported lazily to keep PaymentService (which imports OrderService) out of
 * the static import graph of OrderService / fulfilment.
 */
export function kickPendingRefunds(): void {
  void import('./paymentService')
    .then((m) => m.PaymentService.processDueRefunds())
    .catch((err) => console.error('[payments] immediate refund processing failed (will be retried):', err instanceof Error ? err.message : err));
}
