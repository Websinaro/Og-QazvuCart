-- Item-level, per-seller-parcel returns.
--
-- A return request now targets ONE seller parcel (seller_order_id) and lists
-- the order lines/quantities being returned in return_items, with the refund
-- and seller-earning amounts snapshotted at request time. Approving a request
-- acts on that parcel only. Rows created before this migration have
-- seller_order_id NULL and keep the old whole-order behaviour.

ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS seller_order_id INTEGER REFERENCES seller_orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS return_requests_seller_order_idx ON return_requests(seller_order_id);

-- "One live return per order" is replaced by a per-line quantity guard
-- (see OrderTrackingService.requestReturn), so partial returns can coexist.
DROP INDEX IF EXISTS return_requests_one_live_idx;

CREATE TABLE IF NOT EXISTS return_items (
  id SERIAL PRIMARY KEY,
  return_request_id INTEGER NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_amount INTEGER NOT NULL CHECK (line_amount >= 0),        -- gross value of the returned units (rupees)
  refund_amount INTEGER NOT NULL CHECK (refund_amount >= 0),    -- customer refund, net of pro-rata coupon (rupees)
  commission_amount INTEGER NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  seller_earning INTEGER NOT NULL DEFAULT 0 CHECK (seller_earning >= 0),
  CONSTRAINT return_items_request_item_uniq UNIQUE (return_request_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS return_items_order_item_idx ON return_items(order_item_id);
