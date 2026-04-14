-- =====================================================================
-- BACKUP DO ESTADO ACTUAL — corre ANTES de aplicar as migrations
-- Projecto: umlndumjfamfsswwjgoo (ERP Infinity v2)
-- Data: 2026-04-14
-- Razão: change `add-document-folders-ui` — altera `doc_types` e
--        `lead_attachments`; cria tabela nova `negocio_documents`.
-- =====================================================================
-- Executar no Supabase Studio SQL Editor com um utilizador que tenha
-- permissão de SELECT em pg_catalog / information_schema.
-- Guardar os resultados de cada SELECT num ficheiro local (CSV ou JSON)
-- antes de passar para o 02-APPLY-MIGRATIONS.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Snapshot do SCHEMA (DDL) — colunas, tipos, defaults, constraints
-- ---------------------------------------------------------------------

-- 1.1 — doc_types (antes da alteração)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'doc_types'
ORDER BY ordinal_position;

-- 1.2 — lead_attachments (antes da alteração)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lead_attachments'
ORDER BY ordinal_position;

-- 1.3 — confirmar que negocio_documents NÃO existe ainda
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'negocio_documents'
) AS negocio_documents_exists;

-- 1.4 — índices actuais em doc_types e lead_attachments
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('doc_types', 'lead_attachments')
ORDER BY tablename, indexname;

-- 1.5 — triggers em lead_attachments (para saber se há algum que precise preservar)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('doc_types', 'lead_attachments');

-- 1.6 — FKs que apontam para doc_types (podem ser afectadas se adicionarmos colunas)
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'doc_types' OR tc.table_name = 'doc_types');


-- ---------------------------------------------------------------------
-- 2. Snapshot de DADOS — contagens e dumps completos (pequenas tabelas)
-- ---------------------------------------------------------------------

-- 2.1 — Contagens actuais (para validar depois que nada se perdeu)
SELECT
  (SELECT count(*) FROM doc_types)        AS doc_types_count,
  (SELECT count(*) FROM lead_attachments) AS lead_attachments_count;

-- 2.2 — Dump completo de doc_types (geralmente <100 linhas)
SELECT * FROM doc_types ORDER BY category NULLS FIRST, name;

-- 2.3 — Dump completo de lead_attachments (se for grande, exportar em CSV)
SELECT * FROM lead_attachments ORDER BY created_at;

-- 2.4 — Categorias distintas em doc_types (para referência no backfill)
SELECT category, count(*) AS n_types
FROM doc_types
GROUP BY category
ORDER BY n_types DESC;


-- ---------------------------------------------------------------------
-- 3. Snapshot de FUNÇÕES e TRIGGERS do schema public (inventário)
-- ---------------------------------------------------------------------

-- 3.1 — Funções existentes no schema public
SELECT routine_name, routine_type, data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 3.2 — Triggers existentes no schema public
SELECT event_object_table, trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ---------------------------------------------------------------------
-- 4. CHECKSUM sugerido — guarda estes valores
-- ---------------------------------------------------------------------

-- Hash das linhas de doc_types (para comparar depois da migration)
SELECT md5(string_agg(id::text || coalesce(name, '') || coalesce(category, ''), '|'
                      ORDER BY id)) AS doc_types_fingerprint
FROM doc_types;

-- Hash das linhas de lead_attachments
SELECT md5(string_agg(id::text || coalesce(url, '') || coalesce(name, ''), '|'
                      ORDER BY id)) AS lead_attachments_fingerprint
FROM lead_attachments;


-- =====================================================================
-- FIM — guarda os resultados antes de prosseguir.
-- Próximo passo: 01-APPLY-MIGRATIONS.sql
-- =====================================================================
