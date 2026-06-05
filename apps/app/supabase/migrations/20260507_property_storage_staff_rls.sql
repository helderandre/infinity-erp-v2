-- ============================================================================
-- RLS staff access em dev_property_media + dev_property_specifications + doc_registry
-- ============================================================================
-- Mesma causa raiz da migration 20260506: estas tabelas têm RLS ENABLED mas
-- só têm policies SELECT para o portal externo de proprietários (`*_owner_read`)
-- e/ou para o site público (`*_public_read`). Não existe nenhuma policy que
-- permita INSERT / UPDATE / DELETE pelo staff interno via cliente server.
--
-- Sintoma: upload de imagens em /api/properties/[id]/media falhava com
--   "new row violates row-level security policy for table dev_property_media".
--   O mesmo aplica-se a edição de specs e a inserção de documentos.
--
-- Decisão: replicar o padrão `*_staff_all` introduzido em 20260506 — policy
-- FOR ALL gated por membership em dev_users com is_active=true. Mantém as
-- policies do portal owner + do site público intactas (RLS combina por OR).
--
-- NOTA: dev_property_internal já tem `authenticated_full_access FOR ALL`
-- e não precisa desta migration.
--
-- Aditiva. Revert:
--   DROP POLICY IF EXISTS dev_property_media_staff_all ON public.dev_property_media;
--   DROP POLICY IF EXISTS dev_property_specifications_staff_all ON public.dev_property_specifications;
--   DROP POLICY IF EXISTS doc_registry_staff_all ON public.doc_registry;
-- ============================================================================

DROP POLICY IF EXISTS dev_property_media_staff_all ON public.dev_property_media;
CREATE POLICY dev_property_media_staff_all
  ON public.dev_property_media
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  );

DROP POLICY IF EXISTS dev_property_specifications_staff_all ON public.dev_property_specifications;
CREATE POLICY dev_property_specifications_staff_all
  ON public.dev_property_specifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  );

DROP POLICY IF EXISTS doc_registry_staff_all ON public.doc_registry;
CREATE POLICY doc_registry_staff_all
  ON public.doc_registry
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dev_users du WHERE du.id = auth.uid() AND du.is_active = true)
  );
