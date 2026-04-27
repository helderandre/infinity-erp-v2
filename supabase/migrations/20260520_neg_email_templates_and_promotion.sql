-- ==================================================================
-- MIGRATION: neg_email_templates_and_promotion
-- ==================================================================
-- Seeda 4 templates de email do sistema em `tpl_email_library` para o
-- fluxo PROC-NEG, e promove as 4 subtasks `type=checklist` para
-- `type=email` apontadas a esses templates:
--
--   1. neg-cpcv-assinatura          → Stage 2 "Enviar CPCV para assinatura"
--   2. neg-checklist-pre-escritura  → Stage 3 "Email checklist aos clientes"
--   3. neg-agradecimento-escritura  → Stage 5 "Email de agradecimento aos clientes"
--   4. neg-fecho-rede               → Stage 5 "Email à Remax Convictus"
--
-- Bodies em PT-PT formal com `[PLACEHOLDERS]` em texto simples — o
-- consultor ajusta no editor (Standard ou Avançado) ao primeiro envio
-- substituindo pelos `{{variáveis}}` do sistema. Bodies são minimais
-- para não bloquear o fluxo; iteração de copy fica para a equipa.
--
-- Templates ficam `scope='global', is_system=true, is_active=true` —
-- visíveis a todos os consultores, protegidos contra delete.
-- `signature_mode='process_owner'` (default) injecta a assinatura do
-- consultor responsável do processo.
--
-- IDEMPOTÊNCIA: cada INSERT é guardado por NOT EXISTS contra
-- `slug + is_system=true`. Re-aplicar a migration é seguro.
-- O UPDATE das subtasks usa `jsonb_set` que sobrescreve `type` e
-- adiciona `email_library_id` — também idempotente.
--
-- ADITIVA. Revert no fim.
-- ==================================================================

-- ──────────────────────────────────────────────────────────────────
-- 1. Seed templates
-- ──────────────────────────────────────────────────────────────────

INSERT INTO public.tpl_email_library
  (name, subject, body_html, description, slug, scope, is_system, category, signature_mode)
SELECT
  'PROC-NEG — Envio de CPCV para Assinatura',
  'CPCV — Contrato de Promessa de Compra e Venda para assinatura',
  '<p>Caro(a) [Nome do Cliente],</p>'
  || '<p>Em anexo encontra o Contrato de Promessa de Compra e Venda relativo ao imóvel sito em [Morada do Imóvel].</p>'
  || '<p>Solicitamos que reveja o documento e nos devolva assinado, juntamente com o comprovativo de pagamento do sinal acordado de [Valor do Sinal].</p>'
  || '<p>Para qualquer esclarecimento, não hesite em contactar-nos.</p>'
  || '<p>Com os melhores cumprimentos,</p>',
  'Email enviado aos compradores/vendedores na fase 2 do PROC-NEG. Contém o CPCV em anexo e instruções para assinatura + pagamento de sinal.',
  'neg-cpcv-assinatura',
  'global',
  true,
  'PROC-NEG',
  'process_owner'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tpl_email_library
  WHERE slug = 'neg-cpcv-assinatura' AND is_system = true
);

INSERT INTO public.tpl_email_library
  (name, subject, body_html, description, slug, scope, is_system, category, signature_mode)
SELECT
  'PROC-NEG — Checklist Pré-Escritura',
  'Documentos necessários para a Escritura',
  '<p>Caro(a) [Nome do Cliente],</p>'
  || '<p>Aproxima-se a data da escritura do imóvel sito em [Morada do Imóvel]. Para que tudo decorra dentro do previsto, precisamos que reúna os seguintes documentos:</p>'
  || '<ul>'
  || '<li><strong>Distrate de Hipoteca</strong> — caso tenha financiamento bancário associado a este negócio, solicite à sua entidade financiadora.</li>'
  || '<li><strong>Declaração de Não-Dívida ao Condomínio</strong> — emitida pela administração do condomínio (validade: 3 meses).</li>'
  || '<li><strong>Comprovativo de IRS</strong> — última declaração disponível.</li>'
  || '<li><strong>Documentos de identificação actualizados</strong> — Cartão de Cidadão e NIF, caso o seu CC esteja perto do fim de validade.</li>'
  || '</ul>'
  || '<p>Logo que tenha confirmação de data, local e hora da escritura, comunicaremos imediatamente. A sua presença e dos restantes intervenientes é obrigatória.</p>'
  || '<p>Para qualquer dúvida, estamos disponíveis.</p>'
  || '<p>Com os melhores cumprimentos,</p>',
  'Checklist enviada aos compradores antes da escritura. Stage 3 do PROC-NEG.',
  'neg-checklist-pre-escritura',
  'global',
  true,
  'PROC-NEG',
  'process_owner'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tpl_email_library
  WHERE slug = 'neg-checklist-pre-escritura' AND is_system = true
);

INSERT INTO public.tpl_email_library
  (name, subject, body_html, description, slug, scope, is_system, category, signature_mode)
SELECT
  'PROC-NEG — Agradecimento + Escritura',
  'Obrigado pela confiança — Escritura concluída',
  '<p>Caro(a) [Nome do Cliente],</p>'
  || '<p>É com enorme satisfação que concluímos hoje a escritura do imóvel em [Morada do Imóvel]. Em anexo segue a cópia digital da escritura para o seu arquivo.</p>'
  || '<p>Foi um privilégio acompanhar este processo consigo. Contamos consigo para futuros projectos imobiliários e ficamos disponíveis para qualquer questão que surja.</p>'
  || '<p>Caso a experiência tenha correspondido às suas expectativas, agradecemos que partilhe a sua opinião através de uma <a href="[Link Google Reviews]">review no Google</a> — é a melhor forma de continuarmos a apoiar outros clientes.</p>'
  || '<p>Com os melhores cumprimentos e um sincero obrigado,</p>',
  'Email final aos compradores no Stage 5 (Encerramento). Anexa a cópia da escritura e pede review no Google.',
  'neg-agradecimento-escritura',
  'global',
  true,
  'PROC-NEG',
  'process_owner'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tpl_email_library
  WHERE slug = 'neg-agradecimento-escritura' AND is_system = true
);

INSERT INTO public.tpl_email_library
  (name, subject, body_html, description, slug, scope, is_system, category, signature_mode)
SELECT
  'PROC-NEG — Comunicação à Rede (Fecho)',
  'Fecho de Processo — [Referência] — [Morada do Imóvel]',
  '<p>Caros colegas,</p>'
  || '<p>Comunicamos o fecho com sucesso do seguinte processo:</p>'
  || '<ul>'
  || '<li><strong>Referência:</strong> [PV / Referência Interna]</li>'
  || '<li><strong>Imóvel:</strong> [Morada do Imóvel]</li>'
  || '<li><strong>Tipo de Negócio:</strong> [Venda / Arrendamento / Trespasse]</li>'
  || '<li><strong>Data de Escritura:</strong> [Data]</li>'
  || '<li><strong>Cenário:</strong> [Pleno / Pleno Agência / Comprador Externo / Angariação Externa]</li>'
  || '</ul>'
  || '<p>Toda a documentação contratual e financeira está arquivada no sistema. Disponíveis para qualquer questão.</p>'
  || '<p>Cumprimentos,</p>',
  'Email interno à rede (Remax Convictus) a comunicar fecho do processo. Stage 5 do PROC-NEG.',
  'neg-fecho-rede',
  'global',
  true,
  'PROC-NEG',
  'process_owner'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tpl_email_library
  WHERE slug = 'neg-fecho-rede' AND is_system = true
);

-- ──────────────────────────────────────────────────────────────────
-- 2. Promote subtasks: checklist → email
-- ──────────────────────────────────────────────────────────────────
-- Helper: para cada subtask alvo, sobrescreve `config.type`='email',
-- adiciona `config.email_library_id`=<id do template>, e remove
-- `config.hint` (já não é placeholder).

WITH neg_proc AS (
  SELECT id FROM public.tpl_processes
  WHERE process_type='negocio' AND name='Processo de Negócio'
  LIMIT 1
),
target_subtasks AS (
  SELECT
    st.id AS subtask_id,
    CASE
      WHEN s.name = 'CPCV' AND t.title = 'Enviar CPCV para assinatura'
        THEN 'neg-cpcv-assinatura'
      WHEN s.name = 'Pré-Escritura' AND t.title = 'Email checklist aos clientes'
        THEN 'neg-checklist-pre-escritura'
      WHEN s.name = 'Encerramento' AND t.title = 'Email de agradecimento aos clientes'
        THEN 'neg-agradecimento-escritura'
      WHEN s.name = 'Encerramento' AND t.title = 'Email à Remax Convictus'
        THEN 'neg-fecho-rede'
    END AS slug
  FROM public.tpl_subtasks st
  JOIN public.tpl_tasks t ON st.tpl_task_id = t.id
  JOIN public.tpl_stages s ON t.tpl_stage_id = s.id
  JOIN neg_proc np ON s.tpl_process_id = np.id
  WHERE (st.config->>'type') = 'checklist'
    AND (
      (s.name = 'CPCV' AND t.title = 'Enviar CPCV para assinatura' AND st.title = 'CPCV enviado a todas as partes')
      OR (s.name = 'Pré-Escritura' AND t.title = 'Email checklist aos clientes' AND st.title = 'Email enviado aos clientes')
      OR (s.name = 'Encerramento' AND t.title = 'Email de agradecimento aos clientes' AND st.title = 'Email de agradecimento enviado')
      OR (s.name = 'Encerramento' AND t.title = 'Email à Remax Convictus' AND st.title = 'Email à rede enviado')
    )
)
UPDATE public.tpl_subtasks st
SET config = (st.config - 'hint')
           || jsonb_build_object(
                'type', 'email',
                'email_library_id',
                  (SELECT id FROM public.tpl_email_library
                   WHERE slug = ts.slug AND is_system = true LIMIT 1)
              )
FROM target_subtasks ts
WHERE st.id = ts.subtask_id
  AND ts.slug IS NOT NULL;

-- ==================================================================
-- REVERT
-- ==================================================================
-- 1. Reverter subtasks: voltar a checklist + remover email_library_id
--    UPDATE tpl_subtasks SET config = (config - 'email_library_id')
--      || jsonb_build_object('type', 'checklist')
--    WHERE config->>'email_library_id' IN (
--      SELECT id::text FROM tpl_email_library
--      WHERE slug IN ('neg-cpcv-assinatura','neg-checklist-pre-escritura',
--                     'neg-agradecimento-escritura','neg-fecho-rede')
--        AND is_system=true
--    );
-- 2. Apagar templates: DELETE FROM tpl_email_library WHERE slug IN
--    ('neg-cpcv-assinatura','neg-checklist-pre-escritura',
--     'neg-agradecimento-escritura','neg-fecho-rede') AND is_system=true;
