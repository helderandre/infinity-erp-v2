# DESVIOS-ACUMULADOS — Referência para Fase 5 e seguintes

**Última actualização:** 2026-03-05
**Fases implementadas:** F1, F2, F3, F4

Este documento consolida todos os desvios das fases anteriores que impactam a implementação das fases seguintes. Usar como referência obrigatória antes de iniciar cada fase.

---

## 🔴 Regras Globais (aplicar em TODAS as fases)

### 1. Tabela de utilizadores: `dev_users` (NÃO `users`)

A tabela `users` é legacy e está vazia. Todo o sistema usa `dev_users`.

```
CORRECTO:  ... REFERENCES dev_users(id)
CORRECTO:  supabase.from("dev_users").select(...)
ERRADO:    ... REFERENCES users(id)
```

**Afecta:** Qualquer JOIN, FK, SELECT ou UI que liste utilizadores.

### 2. Path de páginas: `app/dashboard/` (NÃO `app/(dashboard)/`)

Conforme CLAUDE.md nota #8: as páginas activas são as de `app/dashboard/`.

```
CORRECTO:  app/dashboard/automacao/templates-wpp/page.tsx
CORRECTO:  app/dashboard/automacao/fluxos/page.tsx
CORRECTO:  app/dashboard/automacao/fluxos/editor/page.tsx
CORRECTO:  app/dashboard/automacao/execucoes/page.tsx
CORRECTO:  app/dashboard/automacao/page.tsx
ERRADO:    app/(dashboard)/automacao/...
```

### 3. Tipos Supabase: casts necessários para tabelas `auto_*`

O ficheiro `types/database.ts` ainda não foi regenerado com as tabelas `auto_*`. Até à regeneração, usar casts explícitos:

```typescript
// Padrão usado na F3/F4 — seguir o mesmo
type SupabaseAny = any  // eslint-disable-line

interface DbTemplate {
  id: string
  name: string
  // ... campos da tabela
}

const { data } = await supabase
  .from("auto_wpp_templates")
  .select("*") as { data: DbTemplate[] | null; error: any }
```

Para limpar futuramente: `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts`

---

## 🟡 Desvios por Área

### Tipos TypeScript (`lib/types/`)

**AutomationNode e AutomationEdge** — Definidos como interfaces próprias SEM dependência de `@xyflow/react` (que só será instalado na F5). São compatíveis com React Flow mas standalone:

```typescript
// Actual (lib/types/automation-flow.ts)
export interface AutomationNode {
  id: string
  type: AutomationNodeType
  position: { x: number; y: number }
  data: AutomationNodeData
}
export interface AutomationEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}
```

**Na F5:** Quando instalar `@xyflow/react`, fazer cast simples `nodes as Node[]` ou actualizar os tipos para usar os do React Flow.

**WebhookFieldMapping** — Duplicada em `lib/types/automation-flow.ts` E `lib/webhook-mapping.ts`. Mesma estrutura. Importar de qualquer um dos dois conforme contexto (tipos → `automation-flow.ts`, lógica → `webhook-mapping.ts`).

**WhatsAppInstance** — Actualizado na F3 para corresponder ao schema real do banco:

| Campo no tipo | Coluna no banco | Nota |
|---------------|----------------|------|
| `id` | `id` | UUID |
| `name` | `name` | |
| `uazapi_token` | `uazapi_token` | Era `instance_key` no tipo original F2 |
| `uazapi_instance_id` | `uazapi_instance_id` | |
| `status` | `status` | 'active' / 'inactive' |
| `connection_status` | `connection_status` | 'connected' / 'disconnected' / 'connecting' / 'not_found' |
| `phone` | `phone` | Era `phone_number` no tipo original F2 |
| `profile_name` | `profile_name` | |
| `profile_pic_url` | `profile_pic_url` | |
| `is_business` | `is_business` | |
| `user_id` | `user_id` | FK → `dev_users(id)` |

Campos **NÃO armazenados** no banco (transientes, vindos da API Uazapi em tempo real): `qr_code`, `pair_code`, `last_connected_at`.

**WhatsAppConnectionStatus** — Valores: `disconnected`, `connecting`, `connected`, `not_found`. NÃO tem `banned` (removido). Aliases deprecated mantidos: `WhatsAppInstanceStatus` → `WhatsAppConnectionStatus`.

**WhatsAppTemplate** — Actualizado na F4 para incluir `tags: string[]`. Este campo corresponde à coluna `tags` (jsonb array) na tabela `auto_wpp_templates` que já existia no banco mas faltava no tipo TypeScript.

### API de Variáveis (`GET /api/automacao/variaveis`)

- Filtra `is_active = true` (variáveis desactivadas não aparecem)
- Campo `sampleValue` usa `static_value` da tabela (é null para variáveis dinâmicas como `lead_nome`)
- Para preview com dados reais na F5+, usar hardcoded ou buscar de um registo real:

```typescript
const SAMPLE_VALUES: Record<string, string> = {
  lead_nome: "João Silva",
  lead_email: "joao@email.com",
  lead_telefone: "+351 912 345 678",
  lead_telemovel: "+351 963 456 789",
  lead_origem: "Website",
  lead_estado: "Novo",
  lead_temperatura: "Quente",
  consultor_nome: "Maria Santos",
  consultor_email: "maria@infinitygroup.pt",
  proprietario_nome: "Carlos Ferreira",
  imovel_ref: "REF-2024-001",
  imovel_titulo: "T3 Parque das Nações",
  imovel_preco: "350.000 €",
  data_actual: new Date().toLocaleDateString("pt-PT"),
  empresa_nome: "Infinity Group",
}
```

### Instâncias WhatsApp (`auto_wpp_instances`)

- Eliminação protegida: `POST action=delete` retorna **409** se existirem fluxos vinculados via `wpp_instance_id`. O utilizador deve desvincular os fluxos primeiro.
- Atribuição de utilizador: API completa (`action=assign_user`), UI simplificada (toast informativo). Select de utilizador disponível apenas na criação.

### Templates WhatsApp (`auto_wpp_templates`) — F4

- **Upload de média NÃO implementado** — Os campos de média aceitam URLs directos em vez de upload para Supabase Storage / R2. Para implementar no futuro: adicionar zona de drag-and-drop no `wpp-message-editor.tsx`.
- **Preview usa dados hardcoded** — O preview do template mostra dados de `SAMPLE_VALUES` em vez de permitir selecionar um lead real da base de dados. Para implementar: adicionar um `Select` que carrega leads e passa os dados ao `WppPreview`.
- **Variáveis inseridas como texto `{{variável}}`** — Não como pills visuais (Tiptap). O VariablePicker abre num Popover e ao clicar insere a variável no Textarea. Para pills visuais: instalar `@tiptap/react` + `@tiptap/extension-mention`.
- **Componente `RadioGroup` instalado** (shadcn) para o selector de tipo de áudio no `wpp-message-editor.tsx`.

---

## 📦 Ficheiros Existentes após F1-F4

### Lib / Tipos
```
lib/
  types/
    automation-flow.ts          ✅ 14 node types, union, flow definition, mapas de cores
    whatsapp-template.ts        ✅ WhatsAppInstance, WhatsAppConnectionStatus, WhatsAppTemplate (com tags), WhatsAppMessage
  template-engine.ts            ✅ renderTemplate, extractVariables, extractVariablesFromNodes
  condition-evaluator.ts        ✅ evaluateCondition (10 operadores)
  webhook-mapping.ts            ✅ resolveWebhookMapping, extractAllPaths, getNestedValue
  retry.ts                      ✅ calculateRetryDelay, calculateNextRetryAt
```

### API Routes
```
app/api/
  automacao/
    instancias/route.ts         ✅ GET lista + POST (sync/create/connect/disconnect/status/assign_user/delete)
    variaveis/route.ts          ✅ GET variáveis agrupadas por categoria
    templates-wpp/route.ts      ✅ GET lista + POST criar
    templates-wpp/[id]/route.ts ✅ GET detalhe + PUT actualizar + DELETE soft delete
```

### Páginas
```
app/dashboard/
  automacao/
    instancias/page.tsx         ✅ Gestão de instâncias WhatsApp
    templates-wpp/page.tsx      ✅ Biblioteca de templates WhatsApp
    templates-wpp/editor/page.tsx ✅ Editor de template com preview ao vivo
```

### Componentes
```
components/automations/
  variable-picker.tsx           ✅ Seletor com pills coloridas por categoria
  instance-card.tsx             ✅ Card com avatar, status badge, menu
  instance-connection-sheet.tsx ✅ Sheet QR/pair code + polling 5s
  create-instance-dialog.tsx    ✅ Dialog criação com nome + utilizador
  wpp-preview.tsx               ✅ Preview estilo WhatsApp com phone frame
  wpp-message-card.tsx          ✅ Card draggable com @dnd-kit/sortable
  wpp-message-editor.tsx        ✅ Sheet lateral para editar mensagem individual
  wpp-template-builder.tsx      ✅ Container principal com editor + preview lado a lado
  wpp-template-card.tsx         ✅ Card para listagem na biblioteca
```

### Hooks
```
hooks/
  use-whatsapp-instances.ts     ✅ 8 métodos (sync, create, connect, disconnect, status, assign, delete, details)
  use-wpp-templates.ts          ✅ CRUD completo + duplicar (getTemplate, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate)
```

### Sidebar
```
components/layout/app-sidebar.tsx  ✅ automationItems: Instâncias WhatsApp + Templates WhatsApp
```

### Tabelas Supabase (9 novas)
```
auto_wpp_instances              ✅ + índices + trigger updated_at
auto_wpp_templates              ✅ + índice active/category
auto_flows                      ✅ + índice active + trigger updated_at + trigger versionamento
auto_triggers                   ✅ + índices flow/webhook/schedule
auto_runs                       ✅ + índices flow/status/entity + trigger updated_at
auto_step_runs                  ✅ + índices run/pending/flow
auto_delivery_log               ✅ + índices step/run
auto_webhook_captures           ✅
auto_flow_versions              ✅ + índice flow/version + trigger auto-save

Extensões: pgmq 1.5.1, pg_cron 1.6.4, pg_net 0.19.5
Filas: auto_step_queue, auto_step_dlq
Realtime: auto_step_runs, auto_runs, auto_webhook_captures
Cron: auto-detect-stuck (5min), auto-cleanup (3h diário)
Funções: auto_claim_steps(), auto_reset_stuck_steps(), auto_update_timestamp()
tpl_variables: 27 registos (14 originais + 13 novos com category_color)
```
