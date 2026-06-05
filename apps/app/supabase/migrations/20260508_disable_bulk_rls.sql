-- ============================================================================
-- Disable RLS em bulk nas tabelas onde foi ligada recentemente sem policies
-- de escrita para staff
-- ============================================================================
-- Contexto:
--   Entre 2026-05-05 e 2026-05-06 RLS foi ligada em massa em ~118 tabelas
--   sem que fossem criadas policies de escrita para `authenticated`. Como
--   os endpoints do ERP usam o cliente server (cookies do utilizador), a
--   maioria das funcionalidades partiu silenciosamente — desde "Adicionar
--   proprietário" sempre vazio em processos, até erros directos no upload
--   de imagens (`new row violates row-level security policy for table
--   dev_property_media`).
--
--   As migrations 20260506 e 20260507 introduziram `*_staff_all` em 5
--   tabelas como solução cirúrgica. Decidiu-se agora reverter o estado a
--   "RLS off" no resto das tabelas core do ERP, replicando o padrão pré-
--   existente (ex.: `dev_properties` sempre teve RLS=off). Acesso continua
--   gated no nível da API via `requirePermission(...)`.
--
-- Tabelas mantidas com RLS=on (semântica per-user/privacy):
--   • Auth & rate limits: auth_rate_limits, auth_user_role_assignments,
--                         user_roles, user_links, dev_user_logins
--   • Privacy financeira: dev_consultant_private_data
--   • Chats: internal_chat_*, owner_chat_*, proc_chat_*
--   • Notifs: notifications, owner_notifications, leads_notifications,
--             owner_push_subscriptions, push_subscriptions
--   • Outros sensíveis: hidden_ig_conversations, feedback_submissions
--
-- As policies criadas pelas migrations 20260506/20260507 ficam intactas
-- mas inertes (RLS off => policies não são avaliadas). Quando o portal
-- externo de proprietários for ligado, basta re-enable RLS em
-- property_owners/owners/dev_property_media e as policies kicam.
--
-- Aditiva (não destrói policies, só DISABLE ROW LEVEL SECURITY).
--
-- Revert (caso o portal seja activado e queiramos voltar a forçar RLS):
--   Para cada tabela:
--     ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
-- ============================================================================

-- Owners + property metadata + portal-related (5 tabelas)
ALTER TABLE public.owners                         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_owners                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_role_types               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_property_media             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_property_specifications    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_property_legal_data        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_property_internal          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_registry                   DISABLE ROW LEVEL SECURITY;

-- Users (perfis públicos + tabela legacy)
ALTER TABLE public.dev_users                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_consultant_profiles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                          DISABLE ROW LEVEL SECURITY;

-- Roles (lookup)
ALTER TABLE public.roles                          DISABLE ROW LEVEL SECURITY;

-- Acessos (links da empresa)
ALTER TABLE public.acessos_company_info           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.acessos_custom_sites           DISABLE ROW LEVEL SECURITY;

-- Marketing assets / kit / agent
ALTER TABLE public.agent_materials                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_personal_designs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_assets         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_metrics        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_agent_profiles       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_calendar     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_content_requests     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_design_categories    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_design_templates     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_kit_templates        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_publications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_resources            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts                DISABLE ROW LEVEL SECURITY;

-- Documentos da empresa
ALTER TABLE public.company_documents              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_document_categories    DISABLE ROW LEVEL SECURITY;

-- Email infra
ALTER TABLE public.consultant_email_accounts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_senders                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_emails                     DISABLE ROW LEVEL SECURITY;

-- Concorrência / formulários web
ALTER TABLE public.competitors                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_form_submissions       DISABLE ROW LEVEL SECURITY;

-- Bulk / contact-property send
ALTER TABLE public.bulk_send_jobs                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_property_sends         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_export_events       DISABLE ROW LEVEL SECURITY;

-- Negócios / deals
ALTER TABLE public.deals                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_market_studies         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_proposals              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits                         DISABLE ROW LEVEL SECURITY;

-- Funil
ALTER TABLE public.funnel_manual_events           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_target_overrides        DISABLE ROW LEVEL SECURITY;

-- Treino
ALTER TABLE public.forma_training_material_downloads DISABLE ROW LEVEL SECURITY;

-- Holidays / KV / etc
ALTER TABLE public.holidays_pt                    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store_6f39db24              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_routing_rules     DISABLE ROW LEVEL SECURITY;

-- Lead suite (excepto leads_notifications, mantida por privacidade per-user)
ALTER TABLE public.lead_import_batches            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_activities               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_assignment_rules         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_campaign_metrics         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_campaigns                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_contact_stages           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_contacts                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_entries                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_negocio_stage_history    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_negocios                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_partners                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_pipeline_stages          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_referrals                DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_settings                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_sla_configs              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_tags                     DISABLE ROW LEVEL SECURITY;

-- Processos suite (chat NÃO incluído — mantém RLS)
ALTER TABLE public.proc_alert_log                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_subtasks                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_task_activities           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_task_comments             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpl_form_templates             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpl_subtasks                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpl_variables                  DISABLE ROW LEVEL SECURITY;

-- Recrutamento
ALTER TABLE public.recruitment_budget                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidates             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_contract_templates     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_contracts              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_entry_submissions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_financial_evolution    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_form_fields            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_interviews             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_onboarding             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_origin_profiles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_pain_pitch             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_stage_log              DISABLE ROW LEVEL SECURITY;

-- Tasks (kanban interno)
ALTER TABLE public.tasks                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_list_shares               DISABLE ROW LEVEL SECURITY;

-- Goals (temp_*)
ALTER TABLE public.temp_consultant_goals          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_goal_activity_log         DISABLE ROW LEVEL SECURITY;

-- Stock / Encomendas
ALTER TABLE public.temp_product_categories        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_product_templates         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_product_variants          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_products                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_requisition_items         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_requisitions              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_returns                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_stock                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_stock_movements           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_supplier_order_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_supplier_orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_feedback        DISABLE ROW LEVEL SECURITY;

-- Reports
ALTER TABLE public.weekly_reports                 DISABLE ROW LEVEL SECURITY;
