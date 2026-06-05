-- ============================================================================
-- Migration: Expense Module Improvements
-- - Add partner_id FK to company_transactions
-- - Add field_confidences JSONB for per-field AI confidence
-- - Create company_transaction_audit table for edit tracking
-- ============================================================================

-- 1. Add partner_id to company_transactions
ALTER TABLE company_transactions
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES temp_partners(id) ON DELETE SET NULL;

-- 2. Add field_confidences for per-field AI confidence scores
ALTER TABLE company_transactions
  ADD COLUMN IF NOT EXISTS field_confidences JSONB DEFAULT NULL;

-- 3. Create audit log table for transaction edits
CREATE TABLE IF NOT EXISTS company_transaction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES company_transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'update', 'status_change', 'confirm', 'cancel'
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tx_audit_transaction ON company_transaction_audit(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_partner ON company_transactions(partner_id);
