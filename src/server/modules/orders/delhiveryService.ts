import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db';
import { orders, orderItems, sellerOrders, sellers } from '@/src/db/schema';
import * as dl from '@/src/lib/delhivery';
import { transitionSellerOrder } from './fulfilment';
import { OrderTrackingService } from './orderTrackingService';

export class DelhiveryService {
  /** Registers the seller's pickup address (once) and books the parcel. Returns the waybill. */
  static async createShipmentForParcel(sellerId: number, sellerOrderId: number): Promise<string> {
    const [row] = await db
      .select({ parcel: sellerOrders, order: orders, seller: sellers })
      .from(sellerOrders)
      .innerJoin(orders, eq(sellerOrders.orderId, orders.id))
      .innerJoin(sellers, eq(sellerOrders.sellerId, sellers.id))
      .where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.sellerId, sellerId)))
      .limit(1);
    if (!row) throw new Error('Order not found');
    const { parcel, order, seller } = row;
    if (parcel.status !== 'PACKED') throw new Error('Mark the order as packed before creating a shipment.');
    if (!(order.paymentMethod === 'COD' || order.paymentStatus === 'PAID')) throw new Error('Payment for this order has not been confirmed yet.');
    if (!seller.businessAddress || !seller.pickupCity || !seller.pickupState || !seller.pickupPincode || !seller.supportPhone) {
      throw new Error('Complete your pickup address and phone in Settings before shipping.');
    }

    let warehouse = seller.delhiveryWarehouse;
    if (!warehouse) {
      warehouse = `SELLER-${seller.id}`;
      await dl.registerWarehouse({
        name: warehouse, phone: seller.supportPhone, email: seller.supportEmail, address: seller.businessAddress,
        city: seller.pickupCity, state: seller.pickupState, pin: seller.pickupPincode,
      });
      await db.update(sellers).set({ delhiveryWarehouse: warehouse }).where(eq(sellers.id, seller.id));
    }

    const a = order.shippingAddressSnapshot as Record<string, string>;
    const items = await db.select({ name: orderItems.productName, qty: orderItems.quantity }).from(orderItems).where(eq(orderItems.sellerOrderId, parcel.id));
    return dl.createShipment({
      warehouse, orderNumber: `${order.orderNumber}-${parcel.id}`,
      name: a.fullName, phone: a.phoneNumber, address: `${a.houseBuilding}, ${a.streetArea}`, city: a.city, state: a.state, pin: a.postalCode,
      cod: order.paymentMethod === 'COD', amount: parcel.subtotal,
      description: items.map((i) => i.name).join(', '), quantity: items.reduce((n, i) => n + i.qty, 0),
    });
  }

  /** Polls Delhivery for live parcels and advances them. Run on a schedule (see /api/admin/delhivery/sync). */
  static async syncTracking() {
    if (!dl.isDelhiveryConfigured()) return { checked: 0, updated: 0 };
    const live = await db
      .select({ id: sellerOrders.id, orderId: sellerOrders.orderId, status: sellerOrders.status, waybill: sellerOrders.trackingNumber })
      .from(sellerOrders)
      .where(and(eq(sellerOrders.carrier, 'Delhivery'), inArray(sellerOrders.status, ['SHIPPED', 'OUT_FOR_DELIVERY'])))
      .limit(100);
    let updated = 0;
    for (const p of live) {
      if (!p.waybill) continue;
      try {
        const target = await dl.trackWaybill(p.waybill);
        if (!target || target === p.status) continue;
        const steps = target === 'DELIVERED' && p.status === 'SHIPPED' ? ['OUT_FOR_DELIVERY', 'DELIVERED'] : [target];
        for (const next of steps) {
          if (next === p.status) continue;
          await db.transaction((tx) => transitionSellerOrder(tx, p.id, next, { type: 'ADMIN', userId: 0 }));
          await OrderTrackingService.notifyProgress(p.orderId, next, p.id);
        }
        updated++;
      } catch (err) {
        console.error('[Delhivery] sync failed for', p.waybill, err);
      }
    }
    return { checked: live.length, updated };
  }
}
