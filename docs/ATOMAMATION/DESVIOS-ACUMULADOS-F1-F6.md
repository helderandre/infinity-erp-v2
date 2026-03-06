# DESVIOS-ACUMULADOS — Referência para fases seguintes

**Última actualização:** 2026-03-06
**Fases implementadas:** F1, F2, F3, F4, F5, F6, F7 + Pendentes F4/F5

---

## 🔴 Regras Globais (aplicar em TODAS as fases)

### 1. Tabela de utilizadores: `dev_users` (NÃO `users`)

```
CORRECTO:  ... REFERENCES dev_users(id)
CORRECTO:  supabase.from("dev_users").select(...)
ERRADO:    ... REFERENCES users(id)
```

### 2. Path de páginas: `app/dashboard/` (NÃO `app/(dashboard)/`)

```
CORRECTO:  app/dashboard/automacao/execucoes/page.tsx
ERRADO:    app/(dashboard)/automacao/execucoes/page.tsx
```

### 3. Casts Supabase para tabelas `auto_*`

`types/database.ts` não inclui tabelas `auto_*`. Usar `type SupabaseAny = any` + interfaces locais. Para limpar: `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts`

### 4. Testes vs Execuções Reais: coluna `is_test`

A tabela `auto_runs` tem coluna `is_test BOOLEAN DEFAULT false`. Quando o fluxo é disparado pelo botão "Testar" no editor, inserir `is_test: true`. Em produção (webhook, cron, manual real) é `false`.

- **Para filtrar no histórico:** `WHERE is_test = false` (só execuções reais)
- **Para mostrar badge:** `is_test = true` → badge "🧪 Teste"
- **Para métricas:** Excluir `is_test = true` dos cálculos de taxa de sucesso

A route `/api/automacao/fluxos/[flowId]/test` deve passar `is_test: true` no INSERT do run.

---

## 🟡 Desvios por Área

### Tipos TypeScript

**AutomationNode/Edge:** Interfaces próprias (sem `@xyflow/react`). Na F5 foi instalado `@xyflow/react` mas os tipos não foram actualizados — usa-se cast.

**WhatsAppInstance:** Campos reais do banco: `uazapi_token`, `connection_status`, `phone`, `profile_name`. Campos transientes (QR, pair code) vêm da API Uazapi, não armazenados.

**WhatsAppConnectionStatus:** `disconnected | connecting | connected | not_found`. Sem `banned`.

**WebhookFieldMapping:** Duplicada em `automation-flow.ts` e `webhook-mapping.ts` (mesma estrutura).

### Variable Picker

Variáveis inseridas como texto `{{variável}}` (não pills visuais Tiptap). Pills visuais ficam para iteração futura.

### API de Variáveis

- Filtra `is_active = true`
- `sampleValue` usa `static_value` (null para variáveis dinâmicas)
- Sample values hardcoded disponíveis para preview

### Instâncias WhatsApp

- Delete protegido: retorna 409 se houver fluxos vinculados
- Atribuição de utilizador: API completa, UI simplificada

### Templates WhatsApp (F4)

- Upload de média NÃO implementado (aceita URL directa)
- Preview com dados hardcoded + dropdown de lead real (implementado nos pendentes)

### Editor Visual (F5)

- Nodes complexos (Supabase Query, WhatsApp, Email) têm Sheets de configuração (implementadas nos pendentes)
- Auto-layout: hook + botão "Organizar" no canvas (Panel)
- Validação antes de guardar: 7 regras implementadas
- Webhook listener: 120s countdown com Realtime (implementado nos pendentes)
- Tradução cron PT-PT: implementada
- **UX do Supabase Query Node ainda expõe jargão técnico** — refactoring pendente (ver SPEC-REFACTOR-UX-EDITOR.md)

### Motor de Execução (F6)

- **Worker é API Route** (`/api/automacao/worker`) não Edge Function. Mesmo ciclo: claim → process → enqueue → update.
- **Auth do worker:** `Authorization: Bearer CRON_SECRET` (fallback para `SUPABASE_SERVICE_ROLE_KEY`)
- **Processadores em `lib/node-processors/`** — 10 ficheiros, sem duplicação
- **Test route executa realmente** o fluxo via SyncFlowExecutor
- **API de execuções já criada** (GET lista, GET detalhe, POST retry)
- **`is_test` adicionado** ao `auto_runs` para distinguir testes de execuções reais

### Webhook Receiver

- **Versão completa** em `/api/webhook/[key]` — suporta modo síncrono (com Webhook Response node) e assíncrono
- Grava SEMPRE em `auto_webhook_captures` para o listener funcionar

### Webhook Field Mapper

- **NÃO implementado** — `webhook-field-mapper.tsx` para mapear path → variável do payload
- O `webhook-json-tree.tsx` existe para inspecção visual

---

## 📦 Inventário Completo de Ficheiros

### Lib / Tipos
```
lib/types/automation-flow.ts        ✅ 14 node types, union, flow definition, mapas de cores
lib/types/whatsapp-template.ts      ✅ WhatsAppInstance, WhatsAppConnectionStatus, WhatsAppMessage
lib/template-engine.ts              ✅ renderTemplate, extractVariables
lib/condition-evaluator.ts          ✅ evaluateCondition (10 operadores)
lib/webhook-mapping.ts              ✅ resolveWebhookMapping, extractAllPaths
lib/retry.ts                        ✅ calculateRetryDelay, calculateNextRetryAt
lib/sync-flow-executor.ts           ✅ SyncFlowExecutor (execução inline com timeout 25s)
```

### Node Processors
```
lib/node-processors/index.ts        ✅ Registry + interface NodeProcessResult
lib/node-processors/condition.ts    ✅ Avalia AND/OR
lib/node-processors/set-variable.ts ✅ Define variáveis no contexto
lib/node-processors/delay.ts        ✅ Calcula scheduled_for
lib/node-processors/supabase-query.ts ✅ SELECT/INSERT/UPDATE/UPSERT/DELETE/RPC
lib/node-processors/task-lookup.ts  ✅ Busca/cria lead/owner/user
lib/node-processors/whatsapp.ts     ✅ Envia via Uazapi (texto + media)
lib/node-processors/email.ts        ✅ Envia via Resend + log_emails
lib/node-processors/http-request.ts ✅ Chamada HTTP externa
lib/node-processors/webhook-response.ts ✅ Gera resposta para caller
lib/node-processors/notification.ts ✅ Cria notificação no sistema
```

### API Routes
```
app/api/automacao/instancias/route.ts       ✅ GET + POST (sync/create/connect/disconnect/status/delete)
app/api/automacao/variaveis/route.ts        ✅ GET variáveis agrupadas
app/api/automacao/templates-wpp/route.ts    ✅ GET lista + POST criar
app/api/automacao/templates-wpp/[id]/route.ts ✅ GET/PUT/DELETE
app/api/automacao/email-templates/route.ts  ✅ GET lista do tpl_email_library
app/api/automacao/fluxos/route.ts           ✅ GET lista + POST criar
app/api/automacao/fluxos/[flowId]/route.ts  ✅ GET/PUT/DELETE
app/api/automacao/fluxos/[flowId]/test/route.ts ✅ POST testar (execução real)
app/api/automacao/execucoes/route.ts        ✅ GET lista com filtros
app/api/automacao/execucoes/[executionId]/route.ts ✅ GET detalhe + POST retry
app/api/automacao/worker/route.ts           ✅ POST processar fila
app/api/automacao/stats/route.ts            ✅ GET métricas dashboard (F7)
app/api/webhook/[key]/route.ts              ✅ POST/GET receiver (sync + async)
```

### Páginas
```
app/dashboard/automacao/instancias/page.tsx        ✅ Gestão WhatsApp
app/dashboard/automacao/templates-wpp/page.tsx      ✅ Biblioteca templates
app/dashboard/automacao/templates-wpp/editor/page.tsx ✅ Editor template
app/dashboard/automacao/fluxos/page.tsx             ✅ Listagem fluxos
app/dashboard/automacao/fluxos/editor/page.tsx      ✅ Editor canvas + Teste Avançado
app/dashboard/automacao/page.tsx                    ✅ Dashboard automações (F7)
app/dashboard/automacao/execucoes/page.tsx           ✅ Histórico execuções (F7)
```

### Componentes
```
components/automations/variable-picker.tsx           ✅ Pills coloridas
components/automations/instance-card.tsx              ✅
components/automations/instance-connection-sheet.tsx   ✅ QR/pair code
components/automations/create-instance-dialog.tsx      ✅
components/automations/wpp-preview.tsx                ✅ Preview WhatsApp
components/automations/wpp-message-card.tsx            ✅ Draggable
components/automations/wpp-message-editor.tsx          ✅ Sheet editor
components/automations/wpp-template-builder.tsx        ✅ Container + preview
components/automations/wpp-template-card.tsx            ✅ Card biblioteca
components/automations/flow-editor.tsx                ✅ Canvas React Flow
components/automations/flow-sidebar.tsx               ✅ Palette 14 nodes
components/automations/flow-card.tsx                  ✅ Card listagem
components/automations/webhook-json-tree.tsx           ✅ Tree colapsável
components/automations/execution-timeline.tsx          ✅ Timeline steps Realtime (F7)
components/automations/automation-tester.tsx            ✅ Sheet teste com Realtime (F7)
components/automations/stats-cards.tsx                 ✅ Cards métricas + gráfico (F7)
components/automations/execution-detail-sheet.tsx       ✅ Detalhe completo execução (F7)
components/automations/nodes/node-wrapper.tsx          ✅ Base wrapper
components/automations/nodes/trigger-webhook-node.tsx  ✅ 4 estados visuais
components/automations/nodes/trigger-status-node.tsx   ✅
components/automations/nodes/trigger-schedule-node.tsx ✅ Cron PT-PT
components/automations/nodes/trigger-manual-node.tsx   ✅
components/automations/nodes/whatsapp-node.tsx         ✅ Template/Inline
components/automations/nodes/email-node.tsx            ✅ Template/Inline
components/automations/nodes/delay-node.tsx            ✅
components/automations/nodes/condition-node.tsx        ✅ 2 handles
components/automations/nodes/supabase-query-node.tsx   ✅ Sheet configuração
components/automations/nodes/task-lookup-node.tsx      ✅ 2 handles
components/automations/nodes/set-variable-node.tsx     ✅
components/automations/nodes/http-request-node.tsx     ✅
components/automations/nodes/webhook-response-node.tsx ✅
components/automations/nodes/notification-node.tsx     ✅
```

### Hooks
```
hooks/use-whatsapp-instances.ts     ✅ 8 métodos
hooks/use-wpp-templates.ts          ✅ CRUD + duplicar
hooks/use-flows.ts                  ✅ CRUD + testFlow
hooks/use-auto-layout.ts            ✅ BFS layout
hooks/use-webhook-test-listener.ts  ✅ Realtime 120s
hooks/use-executions.ts             ✅ Histórico + detalhes + retry + paginação (F7)
hooks/use-realtime-execution.ts     ✅ Monitoramento Supabase Realtime (F7)
```

### Tabelas Supabase (9 + alterações)
```
auto_wpp_instances      ✅
auto_wpp_templates      ✅
auto_flows              ✅ + trigger versionamento
auto_triggers           ✅
auto_runs               ✅ + is_test (BOOLEAN, default false)
auto_step_runs          ✅ + Realtime
auto_delivery_log       ✅
auto_webhook_captures   ✅ + Realtime
auto_flow_versions      ✅

Extensões: pgmq 1.5.1, pg_cron 1.6.4, pg_net 0.19.5
Filas: auto_step_queue, auto_step_dlq
Funções: auto_claim_steps(), auto_reset_stuck_steps(), auto_update_run_counts(), auto_get_table_columns()
Cron: auto-detect-stuck (5min), auto-cleanup (3h)
tpl_variables: 27 registos
```

---

## 🔮 Pendentes para Implementar

| Item | Prioridade | Contexto |
|------|-----------|----------|
| Refactoring UX Supabase Query Node | Alta | SPEC-REFACTOR-UX-EDITOR.md |
| Webhook Field Mapper (path → variável) | Média | Necessário para webhooks úteis |
| Pills visuais Tiptap (variáveis) | Baixa | Cosmético, funciona com `{{}}` |
| Upload de média R2 (templates WPP) | Baixa | URL directa funciona |
| `is_test: true` no `/api/automacao/fluxos/[flowId]/test` | **CRÍTICO** | Já existe coluna, falta usar no INSERT |
| Parar execução (cancelar steps pendentes) | Baixa | Botão na timeline para UPDATE steps → cancelled |
| Selecção de lead no tester (autocomplete) | Baixa | Actualmente usa campos manuais |
