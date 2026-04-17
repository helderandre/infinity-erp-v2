## 1. Schema e migrations (aplicadas via MCP `mcp__supabase__apply_migration`)

> **Nota**: Após verificação MCP do schema (2026-04-16) confirmou-se: `tpl_email_library` não tem `is_active`, `is_system` nem `status`. `auto_wpp_templates` tem `is_active` mas não tem `is_system` nem `status`. Decisão: usar **só `is_active`** (não introduzir `status='draft|published'`) — simplifica e cobre o caso "esconder do spawner".
>
> Cada migration é aplicada via `mcp__supabase__apply_migration` com `name=20260415_<descrição>`. Após aplicar, o ficheiro `.sql` correspondente fica guardado em `supabase/migrations/` automaticamente.

- [x] 1.1 Migration `add_fixed_contact_automations_tpl_email_library_scope` aplicada via MCP. Adicionou `scope`, `scope_id`, `is_active`, `is_system` + CHECK + índice. 12 rows existentes ficaram `global/active/non-system`.
- [x] 1.2 Migration `add_fixed_contact_automations_auto_wpp_templates_scope` aplicada via MCP. Adicionou `scope`, `scope_id`, `is_system` (já tinha `is_active`). 1 row existente passou para `global/active/non-system`.
- [x] 1.3 Migration `add_fixed_contact_automations_lead_settings` aplicada via MCP. Tabela `contact_automation_lead_settings` criada com unique `(lead_id, event_type)`, FKs opcionais com `ON DELETE SET NULL`, `lead_id` com `ON DELETE CASCADE`, trigger `updated_at`.
- [x] 1.4 Migration `add_fixed_contact_automations_mutes` aplicada via MCP. Tabela `contact_automation_mutes` criada com 4 colunas nullable + CHECK que requer pelo menos `consultant_id` ou `lead_id`. Índices parciais para os dois discriminadores principais + `event_type` + `muted_by`.
- [x] 1.5 Migration `add_fixed_contact_automations_runs_kind_and_virtual_fields` aplicada via MCP. `contact_automation_runs.contact_automation_id` passou a NULL; adicionado `kind ∈ {manual,virtual}`, `lead_id`, `event_type`, `parent_run_id`. CHECK garante consistência. Unique parcial `(lead_id, event_type, scheduled_for) WHERE kind='virtual'`.
- [x] 1.6 Migration `seed_fixed_event_global_templates` aplicada via MCP. 6 seeds (3 email + 3 whatsapp) com `is_system=true`, `is_active=true`, `scope='global'` para `aniversario_contacto`, `natal`, `ano_novo`. Templates de email com PT-PT básico e variáveis `{{lead_nome}}`, `{{consultor_nome}}`, `{{current_year}}`.
- [x] 1.7 Migration `protect_system_templates_from_deletion` aplicada via MCP. Função `block_delete_system_template()` + 2 triggers `BEFORE DELETE` em `tpl_email_library` e `auto_wpp_templates`. Validado via DO block (delete bloqueado com `check_violation`).
- [x] 1.8 `types/database.ts` regenerado via MCP `generate_typescript_types` (492162 chars, 15147 linhas). Novas tabelas e colunas presentes (`contact_automation_lead_settings`, `contact_automation_mutes`, `is_system` em 15 ocorrências, `scope`/`scope_id` em ambas as tabelas de template).
- [x] 1.9 Verificações via MCP `execute_sql` durante a aplicação confirmaram: (a) zero rows violam CHECK em ambas as tabelas de template, (b) 6 seeds activos com `is_system=true`, (c) trigger anti-delete bloqueia com `check_violation` (testado em DO block).

## 2. Lógica de resolução partilhada (`lib/automacao/`)

- [x] 2.1 Criado `lib/automacao/resolve-template-for-lead.ts` com cascata lead → consultant → global; valida assignment antes de aceitar. Só usa `is_active=true` (coluna `status='published'` não existe no schema — decisão registada em design).
- [x] 2.2 Criado `lib/automacao/resolve-account-for-lead.ts` com `resolveSmtpAccountForLead` e `resolveWppInstanceForLead`: override → first-created-active → null. Valida ownership e estado activo da conta/instância antes de aceitar o override.
- [x] 2.3 Criado `lib/automacao/is-muted.ts` com predicado null-as-wildcard via `.or()` em cada discriminador + `count: 'exact'`.
- [x] 2.4 Criado `lib/automacao/next-fixed-occurrence.ts` com fallback 28/02 via `lastDayOfMonth` e viragem de ano automática quando a data já passou.
- [ ] 2.5 Deferido — projecto não tem test runner configurado. Resolvers testados indirectamente pelo spawner e endpoints; testes unitários ficam como follow-up se for adicionado vitest/jest.

## 3. Spawner ampliado

- [x] 3.1 Refactor do spawner em `runManualPhase()` + `runVirtualPhase()`; fase A preservada com assinatura original.
- [x] 3.2 `runVirtualPhase()` pagina leads elegíveis por cursor (`agent_id NOT NULL AND (email OR telemovel)`), itera pelos 3 eventos e aplica reconciliação contra `contact_automations` (D11) antes de computar `next_trigger_at`.
- [x] 3.3 Filtro de janela aplicado via `nextAt.getTime() > windowEnd` → skip.
- [x] 3.4 Gating por canal invoca `isMuted` + `resolveTemplateForLead` + `resolveAccountForLead`; contabiliza `muted`, `no_channel`, `missing_template` em `skipped_breakdown`.
- [x] 3.5 Insert em `contact_automation_runs (kind='virtual',…)` primeiro; unique violation → `skippedBreakdown.already_ran++` e continua.
- [x] 3.6 Cria `auto_runs` + `auto_step_runs` (um step por canal activo) com o mesmo `node_data_snapshot` pattern da fase A.
- [x] 3.7 Batches de 200 leads via cursor paginado por `id`.
- [x] 3.8 Auto_scheduler_log passa a ter `phase ∈ {manual,virtual}` e `skipped_breakdown jsonb`; migration aplicada (`20260416_auto_scheduler_log_phase_and_breakdown`). Um row por fase por tick.
- [x] 3.9 `AUTOMACAO_VIRTUAL_SPAWNER_ENABLED !== 'false'` permite desactivar a fase B via env (default activo).
- [ ] 3.10 Deferido — requer ambiente staging com acesso a SMTP/WhatsApp reais. Checklist movido para secção 11.

## 4. APIs — overrides, mutes, templates consultor-scoped

- [x] 4.1 Criado `app/api/leads/[id]/automation-settings/route.ts` com GET/POST/DELETE, validação Zod e guard `broker || leads.agent_id = user.id`.
- [x] 4.2 POST valida template/acount/instance ownership em `validateOverride`, devolvendo `template_not_accessible | account_not_owned | instance_not_owned`.
- [x] 4.3 Criado `app/api/contact-automation-mutes/route.ts` com GET/POST/DELETE. POST detecta row idêntica do mesmo `muted_by` e devolve `{mute, duplicate:true}` sem criar nova.
- [x] 4.4 `app/api/automacao/email-templates/route.ts` GET aceita `?scope=` + filtro de visibilidade por utilizador; POST aceita `scope` (se `consultant`, força `scope_id=user.id`; `global` só para broker).
- [x] 4.5 `app/api/automacao/templates-wpp/route.ts` GET/POST actualizados com o mesmo pattern.
- [x] 4.6 Scope guard adicionado em DELETE e PUT tanto de `tpl_email_library` (`app/api/libraries/emails/[id]/route.ts`) como `auto_wpp_templates` (`[id]/route.ts` via `assertCanMutate`). `is_system=true` bloqueia sempre.
- [ ] 4.7 Deferido (testes de integração) — mesmo motivo de 2.5.

## 5. APIs — retry e reschedule

- [x] 5.1 Criado `app/api/automacao/runs/[id]/retry/route.ts` que delega em `lib/automacao/spawn-retry.ts` (cascata + conta + auto_run + auto_step_runs + novo contact_automation_runs com `parent_run_id`).
- [x] 5.2 Criado `app/api/automacao/runs/[id]/reschedule/route.ts`: Zod `{trigger_at: datetime()}`; rejeita passado com código `trigger_in_past`.
- [x] 5.3 Criado `app/api/automacao/runs/retry-batch/route.ts` (max 100 ids) devolvendo `results[]` per-id com `ok|forbidden|invalid_status|not_found|no_channels|error`.
- [x] 5.4 Criado `app/api/automacao/runs/reschedule-batch/route.ts` com `trigger_at` partilhado.
- [x] 5.5 Guardas de permissão baseadas em `leads.agent_id=user.id` (broker ignora); erros per-id em batch.
- [ ] 5.6 Rate limit deferido — não existe limitador partilhado no worker actual; follow-up depois de medirmos o tráfego real.

## 6. Hub CRM — página e componentes

- [x] 6.1 Criado `app/dashboard/crm/automatismos-contactos/page.tsx` (Server Component com `requirePermission('leads')` + redirect).
- [x] 6.2 Criado `components/crm/automations-hub/automations-hub.tsx` com 4 tabs controlados por `?tab=` search param.
- [x] 6.3 Criado `scheduled-tab.tsx` com tabela + combos evento/estado; consultor vê só os seus, broker vê consultor.
- [ ] 6.4 Deferido — acções em massa (botão placeholder "Acções em massa (brevemente)"). Dependem de UX mais detalhado; MVP hub fica read-only + filtros.
- [x] 6.5 Criado `GET /api/crm/contact-automations-scheduled` com reconciliação manual/virtual, filtros e paginação por cursor.
- [x] 6.6 Criado `failed-runs-tab.tsx` com botões Reexecutar/Reagendar por linha (dialog com datetime local). Batch UI deferido (endpoint pronto).
- [x] 6.7 Criado `my-templates-tab.tsx` com matriz 3 eventos × 2 canais, Badge "Meu"/"Usa global", link para editor.
- [x] 6.8 Criado `global-mutes-tab.tsx` com toggles TUDO/por-evento × Ambos/Email/WhatsApp (10 toggles, não 12 — "Ambos" é `channel=null`).
- [x] 6.9 Criado `hooks/use-contact-automations-hub.ts` com `useScheduled` e `useFailedRuns`. Invalidation via refetch.
- [x] 6.10 Adicionada entrada "Automatismos Contactos" em `crmItems` (icon `Bell`, permissão `leads`) — aparece no grupo CRM.

## 7. Tab "Automatismos" no lead — adaptação

- [x] 7.1 Criado `components/crm/fixed-events-section.tsx` injectado no topo de `contact-automations-list.tsx`. 3 linhas com status (Automático/Personalizado/Mutado/Sem data) + botões Personalizar + Mutar/Desmutar.
- [x] 7.2 Criado `components/crm/fixed-event-override-dialog.tsx` com selects para template email/whatsapp, conta SMTP, instância WhatsApp, send_hour. Chama POST/DELETE em `/api/leads/[id]/automation-settings`.
- [x] 7.3 Wizard filtra os 3 eventos fixos do RadioGroup. API `POST /api/leads/[id]/automations` devolve 400 `use_fixed_overrides_instead` quando os recebe.
- [x] 7.4 Botão "Abrir no hub CRM" no topo da secção leva para `?tab=agendados` (filtro por lead seria aditivo; MVP abre o hub global).

## 8. Editor de templates consultor-scoped

- [ ] 8.1 Deferido — API aceita `scope` no POST (feito em 4.4), mas o Craft.js email editor não foi estendido com UI de scope nesta iteração. Follow-up: adicionar toggle "Template pessoal" ao topbar do editor.
- [ ] 8.2 Deferido — listagem do editor email ainda usa endpoint legado. Hub `/my-templates-tab` cobre o fluxo MVP.
- [ ] 8.3 Deferido — badge visual de scope fica para iteração de polish.
- [ ] 8.4 Deferido — idem para editor de WhatsApp. API já aceita `scope` no POST.
- [ ] 8.5 Protecção de `is_system` é feita no backend (triggers DB + endpoint 403); UI defer.

## 9. Permissões e sidebar

- [x] 9.1 Permission gate é aplicado na Server Component via `requirePermission('leads')` + redirect (padrão actual do projecto; middleware só cuida de auth).
- [x] 9.2 Entrada adicionada em `crmItems` com icon `Bell` (ver 6.10).
- [x] 9.3 Breadcrumbs derivam automaticamente de `crmItems` via `navMap` em `components/layout/breadcrumbs.tsx` — a nova entrada passa a ser PT-PT por construção.

## 10. Observabilidade e docs

- [x] 10.1 Migration `20260416_auto_scheduler_log_phase_and_breakdown` aplicada. Spawner insere um row por fase por tick com `phase` e `skipped_breakdown`.
- [x] 10.2 Criado `docs/M10-AUTOMACOES/SPEC-FIXED-CONTACT-AUTOMATIONS.md` com arquitectura, cascata, mutes, APIs, observabilidade e feature flags.
- [x] 10.3 Banner em `SPEC-CONTACT-AUTOMATIONS.md` aponta para o novo doc.
- [x] 10.4 CLAUDE.md secção "Contact Automations" actualizada (tabelas novas, hub CRM, cascata, retry/reschedule, feature flags).

## 11. QA e release

- [ ] 11.1 QA em staging — deferido (requer ambiente staging com SMTP/WhatsApp reais).
- [ ] 11.2 Regressão do wizard manual — deferido (smoke test visual: `aniversario_fecho` + `festividade` continuam no selector).
- [ ] 11.3 Tick manual com `curl` — deferido para o dia do deploy.
- [ ] 11.4 Coolify Scheduled Task — sem alteração necessária; o endpoint é o mesmo.
- [ ] 11.5 `openspec archive` — correr após merge em master.
