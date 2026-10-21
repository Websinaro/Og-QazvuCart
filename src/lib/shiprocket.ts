/**
 * Thin Shiprocket client. Env:
 *   SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD - API user credentials (Settings -> API -> Add new API user)
 *   SHIPROCKET_REFERENCE_PINCODE           - fallback PIN used on the other side of serviceability checks (default 110001)
 * Without credentials every function degrades gracefully (checks pass, shipments are manual).
 */
const BASE = 'https://apiv2.shiprocket.in/v1/external';

export const isShiprocketConfigured = () => Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
export const PINCODE_RE = /^[1-9]\d{5}$/;
const REF_PIN = () => process.env.SHIPROCKET_REFERENCE_PINCODE || '110001';

let cached: { token: string; exp: number } | null = null;

async function getToken(force = false): Promise<string> {
  if (!force && cached && cached.exp > Date.now()) return cached.token;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
    cache: 'no-store',
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.token) throw new Error(`Shiprocket login failed: ${String(j?.message ?? `HTTP ${res.status}`).slice(0, 200)}`);
  cached = { token: j.token, exp: Date.now() + 8 * 24 * 3600 * 1000 }; // tokens last 10 days
  return j.token;
}

/** Authenticated request; refreshes the token once on 401. */
async function sr(path: string, init: RequestInit = {}): Promise<Response> {
  const call = async (force: boolean) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}), Authorization: `Bearer ${await getToken(force)}` },
      cache: 'no-store',
    });
  const res = await call(false);
  return res.status === 401 ? call(true) : res;
}

export interface PinInfo { serviceable: boolean; prepaid: boolean; cod: boolean; pickup: boolean }

async function serviceability(pickup: string, delivery: string): Promise<PinInfo | null> {
  if (!isShiprocketConfigured()) return null;
  try {
    const qs = new URLSearchParams({ pickup_postcode: pickup, delivery_postcode: delivery, weight: '0.5', cod: '0' });
    const res = await sr(`/courier/serviceability/?${qs}`);
    if (res.status === 404) return { serviceable: false, prepaid: false, cod: false, pickup: false };
    if (!res.ok) return null; // courier outage must not block address saving
    const j = await res.json().catch(() => null);
    const couriers: Array<{ cod?: number }> = j?.data?.available_courier_companies ?? [];
    if (!couriers.length) return { serviceable: false, prepaid: false, cod: false, pickup: false };
    return { serviceable: true, prepaid: true, cod: couriers.some((c) => Number(c.cod) === 1), pickup: true };
  } catch {
    return null;
  }
}

export const checkPincode = (pin: string) => serviceability(REF_PIN(), pin);

export async function assertDeliverable(pin: string) {
  if (!PINCODE_RE.test(pin)) throw new Error('Enter a valid 6-digit PIN code.');
  const info = await checkPincode(pin);
  if (info && !(info.serviceable && (info.prepaid || info.cod))) throw new Error(`Sorry, we can't deliver to PIN ${pin} yet.`);
}

export async function assertPickupServiceable(pin: string) {
  if (!PINCODE_RE.test(pin)) throw new Error('Enter a valid 6-digit pickup PIN code.');
  const info = await serviceability(pin, REF_PIN());
  if (info && !(info.serviceable && info.pickup)) throw new Error(`Shiprocket cannot pick up from PIN ${pin}. Please use a different pickup address.`);
}

export interface WarehouseInput { name: string; phone: string; email?: string | null; address: string; city: string; state: string; pin: string }

export async function registerWarehouse(w: WarehouseInput) {
  const res = await sr('/settings/company/addpickup', {
    method: 'POST',
    body: JSON.stringify({
      pickup_location: w.name, name: w.name, email: w.email || process.env.SHIPROCKET_EMAIL,
      phone: w.phone.replace(/\D/g, '').slice(-10), address: w.address, address_2: '', city: w.city, state: w.state, country: 'India', pin_code: w.pin,
    }),
  });
  const text = await res.text();
  // Re-registering an existing pickup location is fine; anything else is a real failure.
  if (!res.ok && !/already (exist|added)|exists/i.test(text)) throw new Error(`Shiprocket pickup registration failed: ${text.slice(0, 200)}`);
}

export interface ShipmentInput {
  warehouse: string; orderNumber: string; name: string; phone: string; address: string; city: string; state: string; pin: string;
  cod: boolean; amount: number; description: string; quantity: number; weightGrams?: number;
}

/** Creates the Shiprocket order, auto-assigns a courier and returns the AWB (tracking number). */
export async function createShipment(s: ShipmentInput): Promise<string> {
  const [first, ...rest] = s.name.trim().split(/\s+/);
  const body = {
    order_id: s.orderNumber,
    order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: s.warehouse,
    billing_customer_name: first || s.name, billing_last_name: rest.join(' '),
    billing_address: s.address, billing_city: s.city, billing_pincode: s.pin, billing_state: s.state, billing_country: 'India',
    billing_email: process.env.SHIPROCKET_EMAIL, billing_phone: s.phone.replace(/\D/g, '').slice(-10),
    shipping_is_billing: true,
    order_items: [{ name: s.description.slice(0, 200) || 'Order items', sku: s.orderNumber, units: Math.max(1, s.quantity), selling_price: s.amount }],
    payment_method: s.cod ? 'COD' : 'Prepaid',
    sub_total: s.amount,
    length: 10, breadth: 10, height: 10, weight: (s.weightGrams ?? 500) / 1000,
  };
  const res = await sr('/orders/create/adhoc', { method: 'POST', body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.shipment_id) {
    const why = j?.message || (j?.errors && JSON.stringify(j.errors)) || `HTTP ${res.status}`;
    throw new Error(`Shiprocket could not create the shipment: ${String(why).slice(0, 200)}`);
  }
  const awbRes = await sr('/courier/assign/awb', { method: 'POST', body: JSON.stringify({ shipment_id: j.shipment_id }) });
  const a = await awbRes.json().catch(() => null);
  const awb = a?.response?.data?.awb_code;
  if (!awbRes.ok || !awb) {
    const why = a?.message || a?.response?.data?.awb_assign_error || `HTTP ${awbRes.status}`;
    throw new Error(`Shiprocket could not assign a courier: ${String(why).slice(0, 200)}`);
  }
  return String(awb);
}

/** Maps Shiprocket's tracking status to our parcel states. */
export async function trackWaybill(awb: string): Promise<'OUT_FOR_DELIVERY' | 'DELIVERED' | null> {
  const res = await sr(`/courier/track/awb/${encodeURIComponent(awb)}`);
  if (!res.ok) return null;
  const t = (await res.json().catch(() => null))?.tracking_data;
  const st: string = t?.shipment_track?.[0]?.current_status || '';
  if (!st) return null;
  if (/^delivered$/i.test(st) || Number(t?.shipment_status) === 7) return 'DELIVERED';
  if (/out for delivery/i.test(st) || Number(t?.shipment_status) === 17) return 'OUT_FOR_DELIVERY';
  return null;
}
