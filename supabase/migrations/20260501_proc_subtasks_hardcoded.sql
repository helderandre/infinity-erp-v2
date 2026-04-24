-- ==================================================================
-- MIGRATION: proc_subtasks_hardcoded
-- ==================================================================
-- Introduz a camada de subtarefas hardcoded do módulo de processos:
--
--   1. Adiciona `proc_subtasks.subtask_key TEXT NOT NULL` — identidade
--      estável legível (ex. "email_pedido_doc_singular"), imutável
--      depois de publicada em produção.
--   2. Backfill:
--      - Linhas com `tpl_subtask_id IS NOT NULL` → `legacy_tpl_<uuid>`
--      - Linhas ad-hoc (`tpl_subtask_id IS NULL`) → `legacy_adhoc_<uuid>`
--      Prefixo `legacy_` garante zero colisão com chaves do registry
--      novo.
--   3. Cria `UNIQUE INDEX proc_subtasks_dedup
--      ON (proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`
--      para suportar idempotência + repeatPerOwner.
--   4. Cria tabela `holidays_pt (date PRIMARY KEY, name, scope)` com
--      seed para 2026/2027/2028 (nacionais fixos + Sexta Santa +
--      Corpo de Deus), usada pelo helper `isBusinessDay()` ao calcular
--      `due_date` das subtarefas.
--
-- NOTA: `CREATE INDEX CONCURRENTLY` omitido porque Supabase aplica a
-- migration numa transacção. Volume de `proc_subtasks` é pequeno
-- (~313 linhas no momento da migration), lock negligível.
--
-- NOTA 2: Easter dates (PT moveable holidays) hardcoded em vez de
-- computar via fórmula de Gauss em SQL — mais legível e verificável.
-- Próxima extensão do seed (2029+) pode ser feita via INSERT normal
-- com ON CONFLICT DO NOTHING.
--
-- ADITIVA: nenhuma coluna removida de `proc_subtasks`; todas as colunas
-- (`dependency_*`, `is_blocked`, etc.) preservadas.
--
-- REVERT:
--   DROP TABLE IF EXISTS public.holidays_pt;
--   DROP INDEX IF EXISTS public.proc_subtasks_dedup;
--   ALTER TABLE public.proc_subtasks DROP COLUMN IF EXISTS subtask_key;
-- ==================================================================

-- 1. Adicionar coluna nullable primeiro (permite backfill)
ALTER TABLE public.proc_subtasks
  ADD COLUMN IF NOT EXISTS subtask_key text;

-- 2. Backfill de subtask_key em linhas existentes
-- Estratégia: prefixo `legacy_` + origem + uuid. Nunca colide com
-- chaves futuras (que serão humanas: "email_pedido_doc_singular" etc.).
UPDATE public.proc_subtasks
SET subtask_key = CASE
  WHEN tpl_subtask_id IS NOT NULL THEN 'legacy_tpl_' || tpl_subtask_id::text
  ELSE 'legacy_adhoc_' || id::text
END
WHERE subtask_key IS NULL;

-- 3. Tornar NOT NULL após backfill
ALTER TABLE public.proc_subtasks
  ALTER COLUMN subtask_key SET NOT NULL;

-- 4. Unique index de dedup
-- COALESCE(owner_id, uuid_nil) garante que rules com repeatPerOwner=false
-- (owner_id=NULL) ficam deduped como se fossem `owner_id=uuid_nil`,
-- replicando o padrão já em produção em `contact_automation_lead_settings`.
CREATE UNIQUE INDEX IF NOT EXISTS proc_subtasks_dedup
  ON public.proc_subtasks (
    proc_task_id,
    subtask_key,
    COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 5. Tabela holidays_pt
CREATE TABLE IF NOT EXISTS public.holidays_pt (
  date date PRIMARY KEY,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'national'
);

COMMENT ON TABLE public.holidays_pt IS
  'Feriados portugueses usados pelo helper isBusinessDay() em lib/processes/subtasks/business-days.ts. Seed cobre nacionais fixos + móveis (Sexta Santa, Corpo de Deus) para 2026/2027/2028. Extensão futura: INSERT normal com ON CONFLICT DO NOTHING.';

-- 6. Seed: feriados nacionais fixos + móveis (3 anos)
-- Móveis derivados da Páscoa:
--   Sexta Santa  = Páscoa - 2 dias
--   Corpo de Deus = Páscoa + 60 dias
-- Datas confirmadas manualmente via computus (Gauss):
--   Páscoa 2026 = 5 Abril; 2027 = 28 Março; 2028 = 16 Abril.
INSERT INTO public.holidays_pt (date, name, scope) VALUES
  -- 2026
  ('2026-01-01', 'Ano Novo',                     'national'),
  ('2026-04-03', 'Sexta-feira Santa',            'national'),
  ('2026-04-05', 'Páscoa',                       'national'),
  ('2026-04-25', 'Dia da Liberdade',             'national'),
  ('2026-05-01', 'Dia do Trabalhador',           'national'),
  ('2026-06-04', 'Corpo de Deus',                'national'),
  ('2026-06-10', 'Dia de Portugal',              'national'),
  ('2026-08-15', 'Assunção de Nossa Senhora',    'national'),
  ('2026-10-05', 'Implantação da República',     'national'),
  ('2026-11-01', 'Todos os Santos',              'national'),
  ('2026-12-01', 'Restauração da Independência', 'national'),
  ('2026-12-08', 'Imaculada Conceição',          'national'),
  ('2026-12-25', 'Natal',                        'national'),
  -- 2027
  ('2027-01-01', 'Ano Novo',                     'national'),
  ('2027-03-26', 'Sexta-feira Santa',            'national'),
  ('2027-03-28', 'Páscoa',                       'national'),
  ('2027-04-25', 'Dia da Liberdade',             'national'),
  ('2027-05-01', 'Dia do Trabalhador',           'national'),
  ('2027-05-27', 'Corpo de Deus',                'national'),
  ('2027-06-10', 'Dia de Portugal',              'national'),
  ('2027-08-15', 'Assunção de Nossa Senhora',    'national'),
  ('2027-10-05', 'Implantação da República',     'national'),
  ('2027-11-01', 'Todos os Santos',              'national'),
  ('2027-12-01', 'Restauração da Independência', 'national'),
  ('2027-12-08', 'Imaculada Conceição',          'national'),
  ('2027-12-25', 'Natal',                        'national'),
  -- 2028
  ('2028-01-01', 'Ano Novo',                     'national'),
  ('2028-04-14', 'Sexta-feira Santa',            'national'),
  ('2028-04-16', 'Páscoa',                       'national'),
  ('2028-04-25', 'Dia da Liberdade',             'national'),
  ('2028-05-01', 'Dia do Trabalhador',           'national'),
  ('2028-06-15', 'Corpo de Deus',                'national'),
  ('2028-06-10', 'Dia de Portugal',              'national'),
  ('2028-08-15', 'Assunção de Nossa Senhora',    'national'),
  ('2028-10-05', 'Implantação da República',     'national'),
  ('2028-11-01', 'Todos os Santos',              'national'),
  ('2028-12-01', 'Restauração da Independência', 'national'),
  ('2028-12-08', 'Imaculada Conceição',          'national'),
  ('2028-12-25', 'Natal',                        'national')
ON CONFLICT (date) DO NOTHING;

-- RLS: leitura permissiva a authenticated (feriados são dados públicos).
ALTER TABLE public.holidays_pt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_pt_select_authenticated" ON public.holidays_pt;
CREATE POLICY "holidays_pt_select_authenticated"
  ON public.holidays_pt
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: bloqueada a toda a gente via RLS (only service role bypassa).
-- Edição manual de feriados futuros deve passar pelo admin client ou SQL direto.
