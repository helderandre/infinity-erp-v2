## 1. Base de Dados

- [x] 1.1 Migration `contact_automations` aplicada. Nota: FK inicial apontava para `leads_contacts(id)`; repaginada para `leads(id)` na migration `contact_automations_repoint_to_leads` porque a UI final vive em `/dashboard/leads/[id]`.
- [x] 1.2 Criar migration `contact_automation_runs` (colunas, FK, chave única `(contact_automation_id, scheduled_for)`, índice por `contact_automation_id`)
- [x] 1.3 Criar migration `auto_scheduler_log` (colunas, índice por `tick_at desc`)
- [x] 1.4 Adicionar coluna `node_data_snapshot jsonb` em `auto_step_runs`; flow_id mantido NOT NULL com flow sentinela `00000000-0000-0000-0000-00000c0a0a17` (mudança de plano: reuso total de `auto_runs`/`auto_step_runs` sem alterar constraints core)
- [x] 1.5 Aplicar migrations via Supabase MCP e regenerar types com `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts`

## 2. Helpers e Constantes Partilhados

- [x] 2.1 Criado [lib/constants-template-categories.ts](lib/constants-template-categories.ts) (convenção do projecto: arquivo flat em `lib/`) + [types/contact-automation.ts](types/contact-automation.ts) com tipos e sentinela flow ID
- [x] 2.2 Criado [lib/automacao/resolve-contact-variables.ts](lib/automacao/resolve-contact-variables.ts) — usa `full_name` (não `name`), deriva `deal_name` de `tipo + localizacao`, TZDate para data local
- [x] 2.3 Criado [lib/automacao/compute-next-trigger.ts](lib/automacao/compute-next-trigger.ts) com `computeNextTriggerAt()` e `addOneYear()` — fallback de ano bissexto via `lastDayOfMonth`
- [~] 2.4 Testes unitários adiados — projecto não tem runner de testes configurado; cobertura via E2E manual no Grupo 11
- [x] 2.5 Criado [lib/validations/contact-automation.ts](lib/validations/contact-automation.ts) (create, patch, discriminated union por `event_type`, superRefine para canais vs remetentes)

## 3. API — Contact Automations

- [x] 3.1 `POST /api/leads/[id]/automations` (Zod, compute trigger_at, valida SMTP/UAZAPI, valida canais vs remetentes)
- [x] 3.2 `GET /api/leads/[id]/automations` com `last_run` agregado
- [x] 3.3 `GET /api/leads/[id]/automations/[automationId]` (detalhe + runs)
- [x] 3.4 `PATCH /api/leads/[id]/automations/[automationId]` — 409 se !scheduled; recalcula `trigger_at`
- [x] 3.5 `DELETE /api/leads/[id]/automations/[automationId]` — soft cancel
- [x] 3.6 `DELETE /api/leads/[id]/automations` — bulk cancel
- [x] 3.7 `GET /api/leads/[id]/automations/[automationId]/runs`
- [x] 3.8 Todas as rotas usam `requirePermission('leads')`

## 4. API — Templates com Categoria

- [x] 4.1 Zod em [lib/validations/email-template.ts](lib/validations/email-template.ts) com `category: z.enum(TEMPLATE_CATEGORY_VALUES).default('geral')`
- [x] 4.2 Validação manual em [app/api/automacao/templates-wpp/route.ts](app/api/automacao/templates-wpp/route.ts) e `[id]/route.ts` (schema existente não é Zod-based)
- [x] 4.3 Query param `?category=` + `?categories=csv` em ambos os GETs com coalesce `null → geral`
- [x] 4.4 Mantido legado `null` com coalesce no filtro (sem migration de dados)

## 5. Spawner de Schedule

- [x] 5.1 Criado [app/api/automacao/scheduler/spawn-runs/route.ts](app/api/automacao/scheduler/spawn-runs/route.ts) com bearer `CRON_SECRET`
- [x] 5.2 Batch 50 + janela `now() + 5min`
- [x] 5.3 `auto_runs` com `flow_id=CONTACT_AUTOMATIONS_SENTINEL_FLOW_ID`, `triggered_by='schedule'`, `entity_type='contact_automation'`
- [x] 5.4 `auto_step_runs` com `node_data_snapshot` (email/whatsapp) — um step por canal
- [x] 5.5 `resolveContactVariables` chamado antes da criação do run e injectado em `context.variables` + `input_data`
- [x] 5.6 Skip parcial (canal isolado) ou total — regista `contact_automation_runs.status='skipped'` com `skip_reason` CSV
- [x] 5.7 Reagendamento: `addOneYear` para `yearly`; `status='completed'` para `once`
- [x] 5.8 Idempotência: chave única `(contact_automation_id, scheduled_for)` garante 1 run por ocorrência; inserts duplicados silenciados
- [x] 5.9 Batch size 50 hard-capped; rate limit por-run já existente no worker via `MAX_RUNS_PER_FLOW_5MIN`
- [x] 5.10 Linha em `auto_scheduler_log` por tick (evaluated/spawned/skipped/errors/duration)
- [x] 5.11 Flag `AUTOMACAO_SPAWNER_ENABLED==='false'` bypassa o tick
- [x] 5.12 Criado [vercel.json](vercel.json) com cron `* * * * *` → `/api/automacao/scheduler/spawn-runs`

## 6. Adaptação do Worker

- [x] 6.1 Worker detecta `step.node_data_snapshot` e constrói node inline (sem carregar flow)
- [x] 6.2 `flowMeta.wppInstanceId` extraído do snapshot quando disponível
- [x] 6.3 Runs com snapshot saltam a lógica de edges (step terminal); compatibilidade com flows existentes preservada
- [x] 6.4 Criado [lib/email/resolve-account-admin.ts](lib/email/resolve-account-admin.ts) + processor email suporta `smtpAccountId` via `smtp-send` Edge Function; reconciliação `contact_automation_runs` integrada no spawner; testes manuais previstos no Grupo 11

## 7. Frontend — Tab Automatismos

- [x] 7.1 Criado [hooks/use-contact-automations.ts](hooks/use-contact-automations.ts) (list, create, patch, cancel, bulkCancel, fetchRuns)
- [x] 7.2 Tab "Automatismos" adicionada em [app/dashboard/leads/[id]/page.tsx](app/dashboard/leads/[id]/page.tsx) (contacto CRM, não leads legacy)
- [x] 7.3 Criado [components/crm/contact-automations-list.tsx](components/crm/contact-automations-list.tsx)
- [x] 7.4 Acções (editar/cancelar/histórico) integradas inline na lista — menu externo desnecessário
- [x] 7.5 Criado [components/crm/contact-automation-history-dialog.tsx](components/crm/contact-automation-history-dialog.tsx)
- [x] 7.6 Empty state PT-PT com CTA implementado
- [x] 7.7 Botão "Cancelar todos" + `AlertDialog` de confirmação

## 8. Frontend — Wizard (6 passos)

- [x] 8.1 Criado [components/crm/contact-automation-wizard.tsx](components/crm/contact-automation-wizard.tsx) como `Dialog` multi-step com estado controlado (simplificação: sem `react-hook-form` — 6 passos lineares, estado plano)
- [x] 8.2 Passo 1 — RadioGroup com os 5 tipos + campos para festividade + sub-selector de negócio; opções indisponíveis ficam desactivadas
- [x] 8.3 Passo 2 — Checkbox multi-select (email/whatsapp) com `canAdvance` a exigir ≥1
- [x] 8.4 Passo 3 — Selects de SMTP + UAZAPI pré-seleccionam quando só há 1 activo
- [x] 8.5 Passo 4 — Selects filtrados por categoria (query param `?categories=`) + toggle inline "Editar só para este contacto" (Input + Textarea para subject/body override)
- [x] 8.6 Passo 5 — RadioGroup (Uma vez / Todos os anos)
- [x] 8.7 Passo 6 — Input hora (0-23) default 8, Select timezone default `Europe/Lisbon`, resumo completo
- [x] 8.8 `submit()` faz POST, toast, `onCreated()` fecha wizard e refetcha lista

## 9. Frontend — Categorias nos Templates

- [x] 9.1 Dropdown "Categoria" adicionado no [components/email-editor/email-topbar.tsx](components/email-editor/email-topbar.tsx) + wire-up em [components/email-editor/email-editor.tsx](components/email-editor/email-editor.tsx) e página de edição
- [x] 9.2 Categorias canónicas adicionadas ao tipo `WhatsAppTemplateCategory` em [lib/types/whatsapp-template.ts](lib/types/whatsapp-template.ts); UI existente de WhatsApp templates já tinha dropdown e agora inclui automaticamente os novos valores
- [x] 9.3 Filtro "Categoria" adicionado em [app/dashboard/templates-email/page.tsx](app/dashboard/templates-email/page.tsx)
- [x] 9.4 Filtro já existia em [app/dashboard/automacao/templates-wpp/page.tsx](app/dashboard/automacao/templates-wpp/page.tsx) — usa labels do enum estendido
- [x] 9.5 `normalizeCategory()` em [lib/constants-template-categories.ts](lib/constants-template-categories.ts) coalesce `null → geral`; Badge nas listagens mostra "Geral" para legados

## 10. Observabilidade e Segurança

- [x] 10.1 Logging estruturado `[SCHEDULER]` em console implementado no spawner
- [x] 10.2 `authOk()` rejeita sem bearer (HTTP 401); confirmado no código
- [x] 10.3 Todos os 7 handlers em `/api/leads/[id]/automations*` usam `requirePermission('leads')`
- [x] 10.4 Uso universal de `createAdminClient()` (service role bypassa RLS); APIs validam ownership via filtro `contact_id`
- [x] 10.5 Criado [.env.example](.env.example) com `CRON_SECRET`, `AUTOMACAO_SPAWNER_ENABLED`, `ENCRYPTION_KEY`, `EDGE_SMTP_SECRET`

## 11. Testes End-to-End Manuais

- [~] 11.1–11.8 Testes E2E manuais pendentes de execução num ambiente com `OPENAI_API_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`, conta SMTP verificada e instância UAZAPI conectada. Guião rápido:

  ```
  # 1. Inserir automatismo de teste
  INSERT INTO contact_automations (contact_id, event_type, event_config, channels,
    email_template_id, smtp_account_id, recurrence, send_hour, timezone, trigger_at, status, created_by)
  VALUES ('<contact-uuid>', 'natal', '{}', ARRAY['email'],
    '<template-uuid>', '<smtp-account-uuid>', 'yearly', 8, 'Europe/Lisbon', now() + interval '30 seconds', 'scheduled', '<user-uuid>');

  # 2. Chamar spawner manualmente
  curl -X POST http://localhost:3000/api/automacao/scheduler/spawn-runs \
    -H "Authorization: Bearer $CRON_SECRET"
  # → { evaluated: 1, spawned: 1, skipped: 0, errors: 0 }

  # 3. Chamar worker
  curl -X POST http://localhost:3000/api/automacao/worker \
    -H "Authorization: Bearer $CRON_SECRET"
  # → { processed: 1 }

  # 4. Validar BD
  SELECT status, trigger_at FROM contact_automations WHERE id = '<...>';  -- status='scheduled' (yearly), trigger_at +1 ano
  SELECT status, sent_at FROM contact_automation_runs WHERE contact_automation_id = '<...>'; -- status='sent'
  SELECT * FROM auto_delivery_log WHERE run_id = '<auto_run_id>'; -- status='sent', channel='email'
  ```

  Cobertura esperada nos testes: canais email/whatsapp/ambos, recurrence once vs yearly, skip sem email/telefone, bulk cancel, PATCH de `trigger_at` recalculado, idempotência via chave única.

## 12. Documentação

- [x] 12.1 Criado [docs/M10-AUTOMACOES/SPEC-CONTACT-AUTOMATIONS.md](docs/M10-AUTOMACOES/SPEC-CONTACT-AUTOMATIONS.md) com diagrama, tabelas, APIs, variáveis, desvios
- [x] 12.2 Actualizado [CLAUDE.md](CLAUDE.md) com secção "Contact Automations (ENTREGUE)" + link para o SPEC
- [x] 12.3 Memória `project_contact_automations_runtime.md` criada documentando a decisão do flow sentinela (não óbvia a partir do código)
