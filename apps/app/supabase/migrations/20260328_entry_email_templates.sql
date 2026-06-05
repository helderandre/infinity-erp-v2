-- Migration: Entry email templates in tpl_email_library
-- Date: 2026-03-28

-- Add category column to tpl_email_library for grouping
ALTER TABLE tpl_email_library
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 1. Welcome email (sent to the person who filled the form)
INSERT INTO tpl_email_library (name, subject, description, body_html, category, slug)
VALUES (
  'Boas-vindas — Formulário de Entrada',
  'Bem-vindo(a) à Infinity Group, {{nome}}!',
  'Enviado automaticamente ao candidato após submeter o formulário de entrada.',
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
  'recruitment_entry',
  'entry_welcome'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Internal notification (sent to admin when someone fills the form)
INSERT INTO tpl_email_library (name, subject, description, body_html, category, slug)
VALUES (
  'Notificação Interna — Nova Submissão',
  'Nova submissão de formulário: {{nome}}',
  'Enviado à equipa interna quando um candidato submete o formulário de entrada.',
  '<h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0a0a0a;">Nova submissão de formulário</h2>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  O candidato <strong>{{nome}}</strong> acabou de preencher o formulário de entrada.
</p>
<table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
  <tr>
    <td style="padding: 8px 12px; font-size: 13px; color: #737373; border-bottom: 1px solid #e5e5e5;">Email</td>
    <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">{{email}}</td>
  </tr>
  <tr>
    <td style="padding: 8px 12px; font-size: 13px; color: #737373; border-bottom: 1px solid #e5e5e5;">Telemóvel</td>
    <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">{{telefone}}</td>
  </tr>
</table>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  <a href="{{link_submissao}}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
    Ver Submissão
  </a>
</p>',
  'recruitment_entry',
  'entry_internal_notification'
) ON CONFLICT (slug) DO NOTHING;

-- 3. Email to Convictus
INSERT INTO tpl_email_library (name, subject, description, body_html, category, slug)
VALUES (
  'Notificação Convictus — Novo Consultor',
  'Novo consultor em processo de integração: {{nome}}',
  'Enviado à Convictus quando um candidato submete o formulário de entrada.',
  '<h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0a0a0a;">Novo consultor em integração</h2>
<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
  Informamos que o candidato <strong>{{nome}}</strong> submeteu o formulário de entrada na Infinity Group e está em processo de integração.
</p>
<table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
  <tr>
    <td style="padding: 8px 12px; font-size: 13px; color: #737373; border-bottom: 1px solid #e5e5e5;">Nome</td>
    <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">{{nome}}</td>
  </tr>
  <tr>
    <td style="padding: 8px 12px; font-size: 13px; color: #737373; border-bottom: 1px solid #e5e5e5;">Email</td>
    <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">{{email}}</td>
  </tr>
  <tr>
    <td style="padding: 8px 12px; font-size: 13px; color: #737373; border-bottom: 1px solid #e5e5e5;">Telemóvel</td>
    <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e5e5e5;">{{telefone}}</td>
  </tr>
</table>
<p style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #404040;">
  Com os melhores cumprimentos,
</p>
<p style="margin: 0; font-size: 15px; font-weight: 600; color: #0a0a0a;">
  Equipa Infinity Group
</p>',
  'recruitment_entry',
  'entry_convictus'
) ON CONFLICT (slug) DO NOTHING;

-- Drop the separate recruitment_email_templates table (no longer needed)
DROP TABLE IF EXISTS recruitment_email_templates;
