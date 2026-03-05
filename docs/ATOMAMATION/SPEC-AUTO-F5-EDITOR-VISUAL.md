# SPEC-AUTO-F5-EDITOR-VISUAL — Fase 5: Editor Visual de Fluxos

**Data:** 2026-03-05
**Prioridade:** 🟠 Alta
**Estimativa:** 3-4 sessões de Claude Code
**Pré-requisitos:** F1 (tabelas), F2 (tipos + template engine)

---

## 📋 Objectivo

Criar o editor visual de fluxos de automação usando React Flow (@xyflow/react) com 14 tipos de nodes customizados, sidebar arrastável, validação de conexões, save/load, e integração com os templates de WhatsApp e email existentes. O editor deve ser intuitivo para utilizadores leigos — UX inspirada em Zapier/Monday.com, não em n8n.

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| **API Routes** | |
| `app/api/automacao/fluxos/route.ts` | GET lista, POST criar |
| `app/api/automacao/fluxos/[flowId]/route.ts` | GET, PUT, DELETE fluxo |
| `app/api/automacao/fluxos/[flowId]/test/route.ts` | POST testar fluxo |
| `app/api/automacao/variaveis/route.ts` | GET variáveis do tpl_variables |
| **Páginas** | |
| `app/(dashboard)/automacao/fluxos/page.tsx` | Listagem de fluxos |
| `app/(dashboard)/automacao/fluxos/editor/page.tsx` | Canvas do editor |
| **Componentes principais** | |
| `components/automations/flow-editor.tsx` | Canvas React Flow principal |
| `components/automations/flow-sidebar.tsx` | Palette de nodes arrastáveis |
| `components/automations/flow-card.tsx` | Card na listagem de fluxos |
| **14 Nodes** | |
| `components/automations/nodes/node-wrapper.tsx` | Wrapper base |
| `components/automations/nodes/trigger-webhook-node.tsx` | |
| `components/automations/nodes/trigger-status-node.tsx` | |
| `components/automations/nodes/trigger-schedule-node.tsx` | |
| `components/automations/nodes/trigger-manual-node.tsx` | |
| `components/automations/nodes/whatsapp-node.tsx` | |
| `components/automations/nodes/email-node.tsx` | |
| `components/automations/nodes/delay-node.tsx` | |
| `components/automations/nodes/condition-node.tsx` | |
| `components/automations/nodes/supabase-query-node.tsx` | |
| `components/automations/nodes/task-lookup-node.tsx` | |
| `components/automations/nodes/set-variable-node.tsx` | |
| `components/automations/nodes/http-request-node.tsx` | |
| `components/automations/nodes/webhook-response-node.tsx` | |
| `components/automations/nodes/notification-node.tsx` | |
| **Hooks** | |
| `hooks/use-flows.ts` | CRUD de fluxos |
| `hooks/use-auto-layout.ts` | Auto-layout BFS |

---

## 🎨 Layout do Editor

```
┌────────────────────────────────────────────────────────────────┐
│  ← Fluxos   [Nome editável]   [WhatsApp: Comercial ▼]         │
│              [Descrição]       [Testar ▶] [Guardar 💾]         │
├──────────┬─────────────────────────────────────────────────────┤
│ SIDEBAR  │  CANVAS (React Flow)                                │
│          │                                                     │
│ Gatilhos │     ┌──────────┐                                    │
│ ┌──────┐ │     │ 🔗 Webhook│                                   │
│ │🔗 Web│ │     │ /api/w/...│                                   │
│ │🔄 Sta│ │     └────┬─────┘                                    │
│ │⏰ Age│ │          │                                          │
│ │▶ Man │ │     ┌────┴─────┐                                    │
│ └──────┘ │     │🔀 Condição│                                   │
│          │     │ lead_temp │                                    │
│ Acções   │     └──┬────┬──┘                                    │
│ ┌──────┐ │    Sim │    │ Não                                   │
│ │💬 Wpp│ │   ┌────┴──┐ ┌┴──────┐                              │
│ │✉ Eml │ │   │💬 WhApp│ │⏱ Delay│                             │
│ │⏱ Del │ │   │Boas...│ │ 3 dias│                              │
│ │🔀 Con│ │   └───────┘ └───┬───┘                              │
│ │🗄 Que│ │                  │                                  │
│ │🔍 Bus│ │             ┌────┴────┐                             │
│ │📝 Var│ │             │✉ Email  │                             │
│ │🌐 HTT│ │             │Follow-up│                             │
│ │↩ Resp│ │             └─────────┘                             │
│ │🔔 Not│ │                                                     │
│ └──────┘ │  [MiniMap]  [Zoom] [Fit]                            │
├──────────┴─────────────────────────────────────────────────────┤
```

---

## 🧩 Node Wrapper: `node-wrapper.tsx`

Base visual para todos os nodes. Segue exactamente o padrão do LeveMãe.

```typescript
interface NodeWrapperProps {
  id: string
  nodeType: AutomationNodeType
  selected?: boolean
  icon: React.ReactNode
  title: string
  showTargetHandle?: boolean    // Default: true
  showSourceHandle?: boolean    // Default: true
  children?: React.ReactNode
}
```

**Visual:**
- Largura: 280px
- Border-left 3px colorido (via `nodeAccentMap`)
- Header: ícone em badge colorido + título + botão delete (hover)
- Content: filhos (inputs, selects, preview)
- Handles: `Position.Top` (target) e `Position.Bottom` (source)

---

## 📋 Detalhes de Cada Node

### Triggers (4 nodes)

Todos usam `showTargetHandle={false}` (sem input).

**Webhook:** URL copiável + botão "Ouvir Webhook" (listener com countdown 120s via F7)
**Status:** Select de entidade (Lead/Processo/Negócio) + campo + valores que disparam
**Agendamento:** Input de expressão cron + explicação em PT-PT + timezone
**Manual:** Texto informativo — "Este fluxo será iniciado manualmente"

### WhatsApp Node

**Dois modos:**
1. **Inline** — Lista de mensagens editáveis dentro do node (como LeveMãe)
2. **Template** — Select para escolher template da biblioteca (`auto_wpp_templates`)

```
┌──────────────────────────────┐
│ 💬 WhatsApp                  │
│                              │
│ Modo: (•) Template ( ) Inline│
│                              │
│ Template: [Boas-vindas ▼]    │
│ 3 mensagens: 📝 🖼️ 📄        │
│                              │
│ [⚙️ Configurar]              │
└──────────────────────────────┘
```

### Email Node

**Dois modos:**
1. **Template existente** — Select de `tpl_email_library`
2. **Inline** — Assunto + body com editor visual (reutilizar sistema existente de Craft.js)

```
┌──────────────────────────────┐
│ ✉️ Email                     │
│                              │
│ Template: [Confirmação ▼]    │
│ Assunto: "Confirmação de..." │
│ Para: [Lead > Email]         │
│                              │
│ [⚙️ Editar template]        │
└──────────────────────────────┘
```

### Condition Node

**Handles especiais:** 2 source handles (verde=Sim, vermelho=Não). Usa `showSourceHandle={false}` no wrapper e adiciona handles customizados.

```
┌──────────────────────────────────┐
│ 🔀 Condição                     │
│                                  │
│ [Lead > Temperatura ▼]           │
│ [é igual a ▼]                    │
│ [Quente ▼]                       │
│                                  │
│ [E ▼]  (toggle E/OU)            │
│ [+ Regra]                        │
├─────────────┬────────────────────┤
│  ● Sim      │        ● Não      │
└─────────────┴────────────────────┘
```

**UX para leigos:** Os operadores mostram labels PT-PT ("é igual a", "contém", "está vazio"). O campo de valor mostra dropdown com opções válidas quando possível (ex: valores de estado de lead).

### Supabase Query Node

**O mais complexo.** Configuração abre numa Sheet com operação dinâmica.

```
┌──────────────────────────────┐
│ 🗄️ Consulta Banco            │
│                              │
│ ✅ Configurado               │
│ RPC: upsert_simple_field_val │
│ 3 parâmetros                 │
│ Resultado → query_result     │
│                              │
│ [⚙️ Configurar]             │
└──────────────────────────────┘
```

**Sheet de configuração:**
- Select de operação: Consultar, Inserir, Actualizar, Inserir/Actualizar, Remover, Função
- Para cada operação: campos dinâmicos (tabela, colunas, filtros, dados, RPC name + params)
- Todos os campos de valor suportam pills de variáveis
- Campo "Guardar resultado em" para definir variável de saída

**UX para leigos:** Labels amigáveis — "Consultar" em vez de "SELECT", "Inserir" em vez de "INSERT". Operadores em PT-PT.

### Task Lookup Node

```
┌──────────────────────────────┐
│ 🔍 Buscar Lead               │
│                              │
│ Procurar: [Lead ▼]          │
│ Por: [Email ▼]               │
│ Valor: [Lead > Email]        │
│                              │
│ ☑ Criar se não encontrar     │
│                              │
│ Resultado → entity_id        │
├──────────────┬───────────────┤
│ ● Encontrado │  ● Criado    │
└──────────────┴───────────────┘
```

**Handles especiais:** 2-3 source handles (encontrado/criado/erro).

### Webhook Response Node

```
┌──────────────────────────────┐
│ ↩️ Responder Webhook          │
│                              │
│ Estado HTTP: [200 ▼]        │
│                              │
│ Resposta:                    │
│ {                            │
│   "id": [entity_id],        │
│   "ok": true                 │
│ }                            │
│                              │
│ ☐ Continuar após responder   │
└──────────────────────────────┘
```

**Sem source handle** a menos que "Continuar após responder" esteja activo.

### Outros Nodes (Delay, Set Variable, HTTP Request, Notification)

Seguem exactamente o padrão do LeveMãe — campos inline no node com inputs simples. Ver F2 para os tipos de dados de cada um.

---

## 🔌 API Routes

### `GET /api/automacao/fluxos`

```typescript
// Response: { flows: [{ id, name, description, is_active, wpp_instance_id, created_at, updated_at }] }
```

### `POST /api/automacao/fluxos`

```typescript
// Body: { name?: string }
// Response: { flow: AutoFlow }
// Cria fluxo com flow_definition vazio, redireciona para editor
```

### `GET /api/automacao/fluxos/[flowId]`

```typescript
// Response: { flow: AutoFlow, triggers: AutoTrigger[] }
```

### `PUT /api/automacao/fluxos/[flowId]`

```typescript
// Body: { name?, description?, flow_definition?, is_active?, wpp_instance_id?, triggers? }
// Lógica:
//   1. Update auto_flows
//   2. Se triggers[]: upsert/delete em auto_triggers
//   3. flow_definition change → trigger auto-versionamento
// Response: { flow: AutoFlow }
```

### `DELETE /api/automacao/fluxos/[flowId]`

```typescript
// CASCADE remove triggers, runs, steps
// Response: { ok: true }
```

### `POST /api/automacao/fluxos/[flowId]/test`

```typescript
// Body: { entity_type?, entity_id?, test_variables?: Record<string, string> }
// Lógica:
//   1. Buscar flow_definition
//   2. Encontrar primeiro node após trigger
//   3. Criar auto_runs + primeiro auto_step_runs
//   4. Retornar run_id para monitoramento Realtime
// Response: { run_id, first_step_id }
```

### `GET /api/automacao/variaveis`

```typescript
// Busca tpl_variables agrupadas por category
// Response: { variables: [{ key, label, category, category_color, format_type, sampleValue? }] }
```

---

## ⚙️ Funcionalidades do Canvas

### Drag & Drop da sidebar

1. Sidebar items têm `onDragStart` com `dataTransfer.setData("application/reactflow", type)`
2. Canvas tem `onDrop` que converte coordenadas e cria node com `getDefaultData(type)`
3. Validação: máximo 1 trigger por fluxo

### Validação de conexões (`isValidConnection`)

| Regra | Lógica |
|-------|--------|
| Sem auto-loops | `source !== target` |
| Triggers não podem ser target | `targetNode.type não começa com "trigger_"` |
| Sem ciclos | DFS a partir do target procurando source |
| Condition handles | Se source é condition, `sourceHandle` deve ser "true" ou "false" |
| Task Lookup handles | Se source é task_lookup, `sourceHandle` deve ser "found", "created" ou "error" |
| Webhook Response | Só permite source handle se `continueAfterResponse = true` |

### Detecção de ciclos (DFS)

```typescript
function hasCycle(edges: AutomationEdge[], newSource: string, newTarget: string): boolean {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) || []), edge.target])
  }
  adjacency.set(newSource, [...(adjacency.get(newSource) || []), newTarget])

  const visited = new Set<string>()
  const stack = [newTarget]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === newSource) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) || []) stack.push(next)
  }
  return false
}
```

### Save (handleSave)

```
1. Validar: se tem node WhatsApp, wpp_instance_id deve estar seleccionado
2. Montar flow_definition = { version: 1, nodes, edges }
3. Extrair triggers dos trigger nodes
4. PUT /api/automacao/fluxos/{flowId}
5. Toast de sucesso/erro
```

### Auto-layout (hook `use-auto-layout.ts`)

BFS top-to-bottom a partir dos trigger nodes. Reutilizar exactamente o código do LeveMãe (`hooks/use-auto-layout.ts`).

---

## ✅ Critérios de Aceitação

- [ ] Arrastar todos os 14 tipos de node da sidebar para o canvas
- [ ] Conectar nodes com edges arrastando handles
- [ ] Validação impede ciclos e auto-loops
- [ ] Condition node tem 2 handles (Sim/Não) com cores distintas
- [ ] Task Lookup tem handles Encontrado/Criado
- [ ] Guardar fluxo persiste flow_definition + triggers
- [ ] Carregar fluxo restaura nodes, edges, posições
- [ ] WhatsApp node permite escolher template da biblioteca
- [ ] Email node permite escolher template do tpl_email_library
- [ ] Supabase Query node abre Sheet com configuração completa
- [ ] Auto-layout reorganiza nodes correctamente
- [ ] Testar fluxo cria run + step_run e retorna run_id

## 📝 Notas para o Claude Code

1. **Instalar React Flow:** `npm install @xyflow/react`
2. **Registar TODOS os 14 nodeTypes** no `useMemo` do flow-editor
3. **`getDefaultData(type)`** deve cobrir todos os tipos com dados iniciais válidos
4. **Os nodes reutilizam padrões do LeveMãe** — `memo()`, `NodeProps`, `useReactFlow().updateNodeData()`
5. **Nodes complexos (Supabase Query, WhatsApp, Email)** abrem Sheet para configuração detalhada
6. **Nodes simples (Delay, Set Variable, Notification)** têm inputs inline
7. **A sidebar agrupa nodes:** Gatilhos (4) + Acções (10)
