-- Deal Referrals (multiple referrals per deal, on either side)
CREATE TABLE deal_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('angariacao', 'negocio')),
  referral_type TEXT NOT NULL CHECK (referral_type IN ('interna', 'externa')),
  consultant_id UUID REFERENCES dev_users(id),
  external_name TEXT,
  external_contact TEXT,
  referral_pct NUMERIC NOT NULL CHECK (referral_pct > 0 AND referral_pct <= 100),
  referral_info TEXT,
  is_paid BOOLEAN DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deal_referrals_deal ON deal_referrals(deal_id);
CREATE INDEX idx_deal_referrals_consultant ON deal_referrals(consultant_id) WHERE consultant_id IS NOT NULL;

-- Add "Referências Externas" category for company expenses
INSERT INTO company_categories (name, type, icon, color, is_system, order_index)
VALUES ('Referências Externas', 'expense', 'UserPlus', 'orange', true, 10)
ON CONFLICT (name) DO NOTHING;
