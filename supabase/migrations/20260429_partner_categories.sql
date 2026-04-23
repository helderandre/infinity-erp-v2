CREATE TABLE IF NOT EXISTS partner_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]+$'),
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Briefcase',
  color TEXT NOT NULL DEFAULT 'slate',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_categories_slug ON partner_categories(slug);
CREATE INDEX IF NOT EXISTS idx_partner_categories_active ON partner_categories(is_active);

INSERT INTO partner_categories (slug, label, icon, color, sort_order, is_system) VALUES
  ('supplier',        'Fornecedor',      'Truck',           'teal',    10,  true),
  ('lawyer',          'Advogado',        'Scale',           'violet',  20,  true),
  ('notary',          'Notário',         'Stamp',           'indigo',  30,  true),
  ('bank',            'Banco',           'Landmark',        'blue',    40,  true),
  ('photographer',    'Fotógrafo',       'Camera',          'pink',    50,  true),
  ('constructor',     'Empreiteiro',     'HardHat',         'orange',  60,  true),
  ('insurance',       'Seguros',         'Shield',          'emerald', 70,  true),
  ('energy_cert',     'Cert. Energética','Zap',             'yellow',  80,  true),
  ('cleaning',        'Limpezas',        'Sparkles',        'cyan',    90,  true),
  ('moving',          'Mudanças',        'Truck',           'amber',   100, true),
  ('appraiser',       'Avaliador',       'ClipboardCheck',  'teal',    110, true),
  ('architect',       'Arquitecto',      'Ruler',           'sky',     120, true),
  ('home_staging',    'Home Staging',    'Sofa',            'rose',    130, true),
  ('credit_broker',   'Interm. Crédito', 'BadgePercent',    'lime',    140, true),
  ('interior_design', 'Design Interior', 'Palette',         'fuchsia', 150, true),
  ('marketing',       'Marketing',       'Megaphone',       'red',     160, true),
  ('other',           'Outro',           'Briefcase',       'slate',   999, true)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE partner_categories IS 'Dynamic catalogue of partner categories. Seeded with legacy enum values as is_system=true.';
COMMENT ON COLUMN partner_categories.slug IS 'Stable identifier used by temp_partners.category — immutable once created.';
COMMENT ON COLUMN partner_categories.icon IS 'Lucide icon name (PascalCase). Resolved client-side via a static map.';
COMMENT ON COLUMN partner_categories.color IS 'Tailwind colour token (e.g. teal, blue). Resolved client-side to bg/text/dot variants.';
COMMENT ON COLUMN partner_categories.is_system IS 'Seeded legacy categories — cannot be deleted. Label/icon/colour remain editable.';
