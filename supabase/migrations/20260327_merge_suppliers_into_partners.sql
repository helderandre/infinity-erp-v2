-- =============================================================================
-- Merge temp_suppliers into temp_partners
-- =============================================================================

-- 1. Add supplier-specific columns to temp_partners
ALTER TABLE temp_partners
  ADD COLUMN IF NOT EXISTS average_delivery_days INT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- 2. Insert all suppliers into partners (skip duplicates by name)
INSERT INTO temp_partners (
  id, name, person_type, category, visibility,
  email, phone, website, address, city, postal_code,
  contact_person, nif, internal_notes,
  average_delivery_days, payment_terms,
  rating_avg, rating_count, is_active,
  created_at, updated_at
)
SELECT
  s.id,
  s.name,
  'coletiva',
  'supplier',
  'public',
  s.email,
  s.phone,
  s.website,
  s.address,
  s.city,
  s.postal_code,
  s.contact_name,
  s.nif,
  s.notes,
  s.average_delivery_days,
  s.payment_terms,
  COALESCE(s.rating_avg, 0),
  COALESCE(s.rating_count, 0),
  s.is_active,
  s.created_at,
  s.updated_at
FROM temp_suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM temp_partners p WHERE p.id = s.id
);

-- 3. Re-point temp_supplier_orders FK
ALTER TABLE temp_supplier_orders DROP CONSTRAINT IF EXISTS temp_supplier_orders_supplier_id_fkey;
ALTER TABLE temp_supplier_orders
  ADD CONSTRAINT temp_supplier_orders_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES temp_partners(id);

-- 4. Re-point temp_products FK (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'temp_products' AND column_name = 'supplier_id'
  ) THEN
    BEGIN
      ALTER TABLE temp_products DROP CONSTRAINT IF EXISTS temp_products_supplier_id_fkey;
      ALTER TABLE temp_products
        ADD CONSTRAINT temp_products_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES temp_partners(id);
    EXCEPTION WHEN others THEN
      NULL; -- ignore if constraint doesn't exist
    END;
  END IF;
END $$;

-- 5. Drop temp_suppliers (only after all FKs are re-pointed)
DROP TABLE IF EXISTS temp_suppliers CASCADE;
