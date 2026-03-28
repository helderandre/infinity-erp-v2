-- Migration: Recruitment Email Templates (editable system emails)
-- Date: 2026-03-28

CREATE TABLE IF NOT EXISTS recruitment_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- machine key, e.g. 'welcome_entry_form'
  name TEXT NOT NULL,                   -- display name, e.g. 'Boas-vindas após Formulário'
  description TEXT,                     -- what this email does
  subject TEXT NOT NULL,                -- email subject (supports {{variables}})
  body_html TEXT NOT NULL,              -- email body HTML (supports {{variables}})
  from_email TEXT DEFAULT 'geral@infinitygroup.pt',
  from_name TEXT DEFAULT 'Infinity Group',
  is_active BOOLEAN DEFAULT true,
  variables TEXT[] DEFAULT '{}',        -- available variables for this template
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the welcome email template
INSERT INTO recruitment_email_templates (slug, name, description, subject, body_html, variables)
VALUES (
  'welcome_entry_form',
  'Boas-vindas — Formulário de Entrada',
  'Email enviado automaticamente quando o candidato submete o formulário de entrada.',
  'Bem-vindo(a) à Infinity Group, {{nome}}!',
  '<h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0a0a0a;">Bem-vindo(a) à equipa!</h2>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  Olá <strong>{{nome}}</strong>,
</p>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  Muito obrigado por ter preenchido o formulário de entrada na <strong>Infinity Group</strong>. Recebemos os seus dados com sucesso e a nossa equipa irá analisá-los com a maior brevidade.
</p>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  Os próximos passos do seu processo de integração incluem:
</p>
<ul style="margin: 0 0 16px; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #404040;">
  <li>Validação dos dados e documentos enviados</li>
  <li>Preparação do contrato</li>
  <li>Criação dos seus acessos (email profissional, plataformas)</li>
  <li>Formação inicial e plano de integração</li>
</ul>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  Se tiver alguma dúvida, não hesite em contactar-nos através de <a href="mailto:geral@infinitygroup.pt" style="color: #0a0a0a; font-weight: 600;">geral@infinitygroup.pt</a>.
</p>
<p style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #404040;">
  Com os melhores cumprimentos,
</p>
<p style="margin: 0; font-size: 15px; font-weight: 600; color: #0a0a0a;">
  Equipa Infinity Group
</p>',
  ARRAY['{{nome}}', '{{email}}', '{{telefone}}']
) ON CONFLICT (slug) DO NOTHING;
