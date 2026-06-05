-- Add date_type column to deal_payments
-- Tracks whether the signed_date is a confirmed date or a prediction
-- Values: 'predicted' | 'confirmed'

ALTER TABLE deal_payments
  ADD COLUMN IF NOT EXISTS date_type text NOT NULL DEFAULT 'confirmed'
  CHECK (date_type IN ('predicted', 'confirmed'));

-- Existing payments inserted via /api/deals/[id]/submit are predictions
-- (they're created at submit time before signing); however, since we cannot
-- reliably distinguish them from manually-confirmed payments after the fact,
-- we default everything to 'confirmed' for safety. New deals submitted after
-- this migration will correctly set date_type='predicted'.
