-- ============================================================================
-- RLS staff access em property_owners + owners
-- ============================================================================
-- Contexto:
--   As tabelas `property_owners` e `owners` tinham RLS ENABLED com apenas as
--   policies do portal de proprietários (`property_owners_self_read` /
--   `owners_self_read`), cujo predicado é `owner_id = auth_owner_id()` /
--   `auth_user_id = auth.uid()`. Essas policies foram desenhadas para um
--   portal externo onde o próprio owner faz login, não para o staff interno.
--
--   Resultado: qualquer endpoint do ERP que use o cliente server (cookies
--   do utilizador) — ex: GET /api/processes/[id] — recebia 0 rows, mesmo
--   havendo dados. Sintoma visível: tab "Proprietários" do processo sempre
--   vazia com CTA "Adicionar proprietário", apesar de existirem 67 rows
--   em property_owners no momento desta migration.
--
-- Decisão:
--   Adicionar uma policy `*_staff_all` por tabela que permite TODAS as
--   operações (FOR ALL) a authenticated cuja `auth.uid()` existe em
--   `dev_users` com `is_active = true`. Predicado idêntico em USING e
--   WITH CHECK para suportar leitura E escrita pelo cliente server.
--
--   As policies do portal (`*_self_read`) ficam intactas — RLS combina por
--   OR, portanto o owner continua a ver a sua linha quando entra no
--   portal externo, e o staff passa a ver tudo via dev_users membership.
--
-- Aditiva. Revert:
--   DROP POLICY IF EXISTS property_owners_staff_all ON public.property_owners;
--   DROP POLICY IF EXISTS owners_staff_all ON public.owners;
-- ============================================================================

DROP POLICY IF EXISTS property_owners_staff_all ON public.property_owners;
CREATE POLICY property_owners_staff_all
  ON public.property_owners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_users du
       WHERE du.id = auth.uid()
         AND du.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dev_users du
       WHERE du.id = auth.uid()
         AND du.is_active = true
    )
  );

DROP POLICY IF EXISTS owners_staff_all ON public.owners;
CREATE POLICY owners_staff_all
  ON public.owners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_users du
       WHERE du.id = auth.uid()
         AND du.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dev_users du
       WHERE du.id = auth.uid()
         AND du.is_active = true
    )
  );
