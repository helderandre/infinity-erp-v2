-- ============================================================================
-- meta_sync_jobs — período por DATA (since) em vez de número de dias
--
-- A meta-api passou a interpretar o período de sync por `since` (data
-- YYYY-MM-DD), não por `since_days` (number). Guardamos a data escolhida pelo
-- utilizador (null = "todo o período"). A coluna since_days fica como legado
-- (nullable, já não é escrita por código novo).
--
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

alter table public.meta_sync_jobs
  add column if not exists since text;

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- alter table public.meta_sync_jobs drop column if exists since;
-- ============================================================================
