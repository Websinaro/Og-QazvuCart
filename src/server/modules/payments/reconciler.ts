/**
 * Payment reconciliation: compares Razorpay's records with ours and repairs
 * what is safe to repair.
 *
 * Direction 1 (gateway -> us): every payment/refund Razorpay lists in the
 *   window is matched to our rows. Money the gateway holds that we never
 *   recorded (lost webhook, closed tab) is applied through the SAME engine
 *   path as a webhook, so all amount/state rules still apply.
 * Direction 2 (us -> gateway): payments we believe are PAID but that did not
 *   show up in the listing are fetched individually; a "paid" order with no
 *   money behind it is never auto-changed, only reported.
 *
 * Findings are persisted (payment_reconciliation_runs / _items) so a human
 * can work the NEEDS_REVIEW list.
 */
import { classifyPayment } from '@/src/lib/paymentRules';
import type { RemotePayment, RemoteRefund } from '@/src/lib/paymentRules';
import type { PaymentEngine } from './paymentEngine';
import type { PaymentGateway, PaymentsStore, ReconRunSummary } from './ports';

const PAGE = 100;
const MAX_PAGES = 50;

async function pageAll<T>(fetchPage: (skip: number) => Promise<{ items: T[] }>): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { items } = await fetchPage(i * PAGE);
    all.push(...items);
    if (items.length < PAGE) break;
  }
  return all;
}

export interface ReconcileOptions {
  from: Date;
  to: Date;
  /** false = report only, change nothing. */
  heal?: boolean;
  trigger?: 'MANUAL' | 'SCHEDULED';
  triggeredBy?: number | null;
}

export class PaymentReconciler {
  constructor(
    private readonly store: PaymentsStore,
    private readonly gateway: PaymentGateway,
    private readonly engine: PaymentEngine,
  ) {}

  async run(opts: ReconcileOptions): Promise<ReconRunSummary> {
    const heal = opts.heal ?? true;
    const runId = await this.store.createReconRun({
      trigger: opts.trigger ?? 'MANUAL', heal, from: opts.from, to: opts.to, triggeredBy: opts.triggeredBy ?? null,
    });
    const s = { gatewayPaymentsChecked: 0, gatewayRefundsChecked: 0, localPaymentsChecked: 0, matched: 0, autoHealed: 0, needsReview: 0 };

    try {
      const fromSec = Math.floor(opts.from.getTime() / 1000);
      const toSec = Math.floor(opts.to.getTime() / 1000);
      const remotePayments = await pageAll((skip) => this.gateway.listPayments({ from: fromSec, to: toSec, count: PAGE, skip }));
      const remoteRefunds = await pageAll((skip) => this.gateway.listRefunds({ from: fromSec, to: toSec, count: PAGE, skip }));
      s.gatewayPaymentsChecked = remotePayments.length;
      s.gatewayRefundsChecked = remoteRefunds.length;

      // captured first so a failed sibling attempt can't pre-empt the success
      const ordered = [...remotePayments].sort((a, b) => Number(b.status === 'captured') - Number(a.status === 'captured'));
      const seen = new Set<string>();
      for (const remote of ordered) {
        if (!remote.order_id) continue;
        seen.add(remote.order_id);
        await this.reconcilePayment(runId, remote, heal, s);
      }

      // Direction 2: our PAID rows the listing did not cover.
      const local = await this.store.listPaymentsInWindow(opts.from, opts.to);
      s.localPaymentsChecked = local.length;
      for (const row of local) {
        if (!row.providerOrderId || seen.has(row.providerOrderId) || row.status !== 'PAID') continue;
        if (!row.providerPaymentId) continue;
        try {
          const remote = await this.gateway.fetchPayment(row.providerPaymentId);
          await this.reconcilePayment(runId, { ...remote, order_id: remote.order_id ?? row.providerOrderId }, heal, s);
        } catch (err) {
          const status = (err as { status?: number | null }).status;
          s.needsReview++;
          await this.store.addReconItem(runId, {
            kind: 'LOCAL_PAID_MISSING_AT_GATEWAY', resolution: 'NEEDS_REVIEW', paymentId: row.id, orderId: row.orderId,
            providerOrderId: row.providerOrderId, providerPaymentId: row.providerPaymentId, localStatus: row.status,
            localAmount: row.capturedAmount, details: { httpStatus: status ?? null, error: String(err).slice(0, 300) },
          });
        }
      }

      for (const rr of remoteRefunds) await this.reconcileRefund(runId, rr, heal, s);

      await this.store.finishReconRun(runId, s);
      return { id: runId, ...s };
    } catch (err) {
      await this.store.finishReconRun(runId, { ...s, error: err instanceof Error ? err.message.slice(0, 500) : 'error' }).catch(() => undefined);
      throw err;
    }
  }

  private async reconcilePayment(runId: number, remote: RemotePayment, heal: boolean, s: { matched: number; autoHealed: number; needsReview: number }) {
    const local = remote.order_id ? await this.store.findPaymentByProviderOrderId(remote.order_id) : null;
    const processedRefunds = local ? await this.store.sumProcessedRefunds(local.id) : 0;
    const v = classifyPayment(local, remote, processedRefunds);
    const base = {
      kind: v.kind, paymentId: local?.id ?? null, orderId: local?.orderId ?? null,
      providerOrderId: remote.order_id, providerPaymentId: remote.id,
      localStatus: local?.status ?? null, remoteStatus: remote.status,
      localAmount: local?.amount ?? null, remoteAmount: remote.amount,
    };

    if (v.action === 'NONE') { s.matched++; return; }
    if (v.action === 'INFO') { await this.store.addReconItem(runId, { ...base, resolution: 'INFO' }); return; }
    if (v.action === 'REVIEW' || !heal) {
      s.needsReview++;
      await this.store.addReconItem(runId, { ...base, resolution: 'NEEDS_REVIEW', details: { healSkipped: v.action === 'HEAL' } });
      return;
    }
    try {
      const r = await this.engine.applyRemotePayment(remote, 'reconcile');
      s.autoHealed++;
      await this.store.addReconItem(runId, { ...base, resolution: 'AUTO_HEALED', details: { outcome: r.outcome } });
    } catch (err) {
      s.needsReview++;
      await this.store.addReconItem(runId, { ...base, resolution: 'NEEDS_REVIEW', details: { healFailed: String(err).slice(0, 300) } });
    }
  }

  private async reconcileRefund(runId: number, rr: RemoteRefund, heal: boolean, s: { matched: number; autoHealed: number; needsReview: number }) {
    const receipt = /^rf_(\d+)$/.exec(rr.receipt ?? '');
    const local = await this.store.findRefundByGatewayRef({ providerRefundId: rr.id, receiptId: receipt ? Number(receipt[1]) : null });
    const wantedStatus = rr.status === 'processed' ? 'PROCESSED' : rr.status === 'failed' ? 'FAILED' : 'PENDING';
    if (local && local.status === wantedStatus && local.providerRefundId === rr.id && local.amount === rr.amount) { s.matched++; return; }

    const base = {
      paymentId: local?.paymentId ?? null, orderId: local?.orderId ?? null, providerPaymentId: rr.payment_id,
      providerRefundId: rr.id, localStatus: local?.status ?? null, remoteStatus: rr.status,
      localAmount: local?.amount ?? null, remoteAmount: rr.amount,
    };
    if (local && local.amount !== rr.amount) {
      s.needsReview++;
      await this.store.addReconItem(runId, { ...base, kind: 'REFUND_AMOUNT_DIFFERS', resolution: 'NEEDS_REVIEW' });
      return;
    }
    const kind = local ? 'REFUND_STATUS_DIFFERS' : 'REFUND_NOT_IN_LOCAL';
    if (!heal) { s.needsReview++; await this.store.addReconItem(runId, { ...base, kind, resolution: 'NEEDS_REVIEW' }); return; }
    try {
      const r = await this.engine.applyRemoteRefund(rr);
      if (r.outcome === 'UNKNOWN_PAYMENT') { await this.store.addReconItem(runId, { ...base, kind: 'REFUND_UNKNOWN_PAYMENT', resolution: 'INFO' }); return; }
      s.autoHealed++;
      await this.store.addReconItem(runId, { ...base, kind, resolution: 'AUTO_HEALED', details: { outcome: r.outcome } });
    } catch (err) {
      s.needsReview++;
      await this.store.addReconItem(runId, { ...base, kind, resolution: 'NEEDS_REVIEW', details: { healFailed: String(err).slice(0, 300) } });
    }
  }
}
