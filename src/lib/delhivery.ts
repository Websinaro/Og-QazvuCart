/**
 * Thin Delhivery (One / Express) client. Env:
 *   DELHIVERY_API_TOKEN   - API token from the Delhivery dashboard (required to enable)
 *   DELHIVERY_ENV         - 'staging' (default) | 'production'
 * Without a token every function degrades gracefully (checks pass, shipments are manual).
 */
const BASE = () => (process.env.DELHIVERY_ENV === 'production' ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com');
const headers = () => ({ Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`, Accept: 'application/json' });

export const isDelhiveryConfigured = () => Boolean(process.env.DELHIVERY_API_TOKEN);
export const PINCODE_RE = /^[1-9]\d{5}$/;

export interface PinInfo { serviceable: boolean; prepaid: boolean; cod: boolean; pickup: boolean }

export async function checkPincode(pin: string): Promise<PinInfo | null> {
  if (!isDelhiveryConfigured()) return null;
  const res = await fetch(`${BASE()}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pin)}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return null; // courier outage must not block address saving
  const j = await res.json().catch(() => null);
  const p = j?.delivery_codes?.[0]?.postal_code;
  if (!p) return { serviceable: false, prepaid: false, cod: false, pickup: false };
  const y = (v: unknown) => String(v).toUpperCase() === 'Y';
  return { serviceable: true, prepaid: y(p.pre_paid), cod: y(p.cod), pickup: y(p.pickup) };
}

export async function assertDeliverable(pin: string) {
  if (!PINCODE_RE.test(pin)) throw new Error('Enter a valid 6-digit PIN code.');
  const info = await checkPincode(pin);
  if (info && !(info.serviceable && (info.prepaid || info.cod))) throw new Error(`Sorry, we can't deliver to PIN ${pin} yet.`);
}

export async function assertPickupServiceable(pin: string) {
  if (!PINCODE_RE.test(pin)) throw new Error('Enter a valid 6-digit pickup PIN code.');
  const info = await checkPincode(pin);
  if (info && !(info.serviceable && info.pickup)) throw new Error(`Delhivery cannot pick up from PIN ${pin}. Please use a different pickup address.`);
}

export interface WarehouseInput { name: string; phone: string; email?: string | null; address: string; city: string; state: string; pin: string }

export async function registerWarehouse(w: WarehouseInput) {
  const res = await fetch(`${BASE()}/api/backend/clientwarehouse/create/`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: w.name, email: w.email || undefined, phone: w.phone, address: w.address, city: w.city, pin: w.pin, country: 'India',
      registered_name: w.name, return_address: w.address, return_pin: w.pin, return_city: w.city, return_state: w.state, return_country: 'India',
    }),
  });
  const text = await res.text();
  // Re-registering an existing warehouse is fine; anything else is a real failure.
  if (!res.ok && !/already exist/i.test(text)) throw new Error(`Delhivery warehouse registration failed: ${text.slice(0, 200)}`);
}

export interface ShipmentInput {
  warehouse: string; orderNumber: string; name: string; phone: string; address: string; city: string; state: string; pin: string;
  cod: boolean; amount: number; description: string; quantity: number; weightGrams?: number;
}

export async function createShipment(s: ShipmentInput): Promise<string> {
  const data = {
    shipments: [{
      name: s.name, add: s.address, pin: s.pin, city: s.city, state: s.state, country: 'India', phone: s.phone,
      order: s.orderNumber, payment_mode: s.cod ? 'COD' : 'Prepaid', cod_amount: s.cod ? s.amount : 0, total_amount: s.amount,
      products_desc: s.description.slice(0, 200), quantity: s.quantity, weight: s.weightGrams ?? 500,
    }],
    pickup_location: { name: s.warehouse },
  };
  const res = await fetch(`${BASE()}/api/cmu/create.json`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ format: 'json', data: JSON.stringify(data) }),
  });
  const j = await res.json().catch(() => null);
  const pkg = j?.packages?.[0];
  if (!res.ok || !pkg?.waybill) {
    const why = pkg?.remarks?.join?.(' ') || j?.rmk || j?.error || `HTTP ${res.status}`;
    throw new Error(`Delhivery could not create the shipment: ${String(why).slice(0, 200)}`);
  }
  return String(pkg.waybill);
}

/** Maps Delhivery's package status to our parcel states. */
export async function trackWaybill(waybill: string): Promise<'OUT_FOR_DELIVERY' | 'DELIVERED' | null> {
  const res = await fetch(`${BASE()}/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) return null;
  const st = (await res.json().catch(() => null))?.ShipmentData?.[0]?.Shipment?.Status;
  if (!st) return null;
  if (st.StatusType === 'DL' || /^delivered$/i.test(st.Status || '')) return 'DELIVERED';
  if (/out for delivery|dispatched/i.test(st.Status || '')) return 'OUT_FOR_DELIVERY';
  return null;
}
