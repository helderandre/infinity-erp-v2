-- =============================================================================
-- Supplier Feedback & Delivery Tracking
-- =============================================================================

-- 1. Add delivery tracking columns to temp_supplier_orders
ALTER TABLE temp_supplier_orders
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS at_store_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Backfill ordered_at from created_at for existing orders
UPDATE temp_supplier_orders SET ordered_at = created_at WHERE ordered_at IS NULL;

-- 2. Add rating columns to temp_suppliers
ALTER TABLE temp_suppliers
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0;

-- 3. Supplier order feedback table
CREATE TABLE IF NOT EXISTS supplier_order_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES temp_supplier_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  would_recommend BOOLEAN NOT NULL DEFAULT true,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_feedback_order ON supplier_order_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_feedback_user ON supplier_order_feedback(user_id);

-- 4. RLS
ALTER TABLE supplier_order_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON supplier_order_feedback FOR ALL USING (true) WITH CHECK (true);
