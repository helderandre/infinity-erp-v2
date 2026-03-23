-- ============================================================
-- Financial Module Foundation
-- ============================================================

-- 1. Company Categories (rubricas)
CREATE TABLE company_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon TEXT,
  color TEXT,
  order_index INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed categories
INSERT INTO company_categories (name, type, icon, color, is_system, order_index) VALUES
  ('Comissões Agência', 'income', 'Euro', 'emerald', true, 1),
  ('Loja Marketing', 'income', 'ShoppingBag', 'blue', true, 2),
  ('Rendas', 'expense', 'Building', 'red', true, 3),
  ('Software & Subscrições', 'expense', 'Monitor', 'purple', true, 4),
  ('Salários', 'expense', 'Users', 'amber', true, 5),
  ('Portais Imobiliários', 'expense', 'Globe', 'blue', true, 6),
  ('Ofertas Consultores', 'expense', 'Gift', 'pink', true, 7),
  ('Material Físico', 'expense', 'Package', 'slate', true, 8),
  ('Serviços Profissionais', 'expense', 'Briefcase', 'indigo', true, 9),
  ('Outros', 'both', 'MoreHorizontal', 'slate', false, 99);

-- 2. Company Recurring Templates
CREATE TABLE company_recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  entity_name TEXT,
  entity_nif TEXT,
  description TEXT,
  amount_net NUMERIC NOT NULL,
  vat_pct NUMERIC DEFAULT 23,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  day_of_month INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Company Transactions
CREATE TABLE company_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT,
  entity_name TEXT,
  entity_nif TEXT,
  description TEXT NOT NULL,
  amount_net NUMERIC NOT NULL,
  amount_gross NUMERIC,
  vat_amount NUMERIC,
  vat_pct NUMERIC DEFAULT 23,
  invoice_number TEXT,
  invoice_date DATE,
  payment_date DATE,
  payment_method TEXT,
  due_date DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID REFERENCES company_recurring_templates(id),
  receipt_url TEXT,
  receipt_file_name TEXT,
  ai_extracted BOOLEAN DEFAULT false,
  ai_confidence NUMERIC,
  reference_type TEXT,
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for company_transactions
CREATE INDEX idx_company_transactions_date ON company_transactions(date);
CREATE INDEX idx_company_transactions_type ON company_transactions(type);
CREATE INDEX idx_company_transactions_category ON company_transactions(category);
CREATE INDEX idx_company_transactions_status ON company_transactions(status);
CREATE INDEX idx_company_transactions_reference ON company_transactions(reference_type, reference_id);

-- 4. Alter deal_payments — add process bridge columns
ALTER TABLE deal_payments
  ADD COLUMN proc_task_id UUID REFERENCES proc_tasks(id),
  ADD COLUMN reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN consultant_invoice_requested_at TIMESTAMPTZ;

CREATE INDEX idx_deal_payments_proc_task ON deal_payments(proc_task_id) WHERE proc_task_id IS NOT NULL;
