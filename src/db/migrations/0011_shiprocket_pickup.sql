-- Courier switched from Delhivery to Shiprocket: rename the registered pickup-location column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'delhivery_warehouse') THEN
    ALTER TABLE sellers RENAME COLUMN delhivery_warehouse TO shiprocket_pickup;
  END IF;
END $$;
-- Pickup locations were registered with Delhivery, not Shiprocket: force re-registration on next shipment.
UPDATE sellers SET shiprocket_pickup = NULL;
-- In-flight parcels keep their Delhivery waybill; relabel nothing. New parcels are tagged 'Shiprocket'.
