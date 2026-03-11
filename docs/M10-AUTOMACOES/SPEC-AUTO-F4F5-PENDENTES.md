# SPEC-AUTO-F4F5-PENDENTES — Implementação dos Itens Adiados das Fases 4 e 5

**Data:** 2026-03-05
**Status:** 🔵 A IMPLEMENTAR
**Pré-requisitos:** F1-F5 implementadas conforme desvios documentados

---

## Contexto

As Fases 4 e 5 foram implementadas com funcionalidades core completas mas com alguns itens adiados para iteração futura. Este documento especifica exactamente o que falta implementar, organizado por prioridade.

### Regras Globais (SEMPRE respeitar)

- Tabela de utilizadores: `dev_users` (NÃO `users`)
- Path de páginas: `app/dashboard/` (NÃO `app/(dashboard)/`)
- Casts `SupabaseAny` para tabelas `auto_*` até regenerar tipos
- Variáveis inseridas como `{{variável}}` nos templates (pills visuais = iteração futura)

---

## 🔴 PRIORIDADE ALTA — Configuração dos Nodes (F5)

Estes itens são críticos porque sem eles os nodes não são funcionais para o worker (F6).

### P1. Sheet de Configuração do Supabase Query Node

**Ficheiro:** `components/automations/nodes/supabase-query-node.tsx`

**Estado actual:** O node mostra badge com operação e tabela/função, mas NÃO abre Sheet para configurar.

**O que implementar:**

Adicionar um botão "Configurar" que abre uma Sheet lateral (padrão shadcn `Sheet` com `SheetContent`) contendo:

1. **Select de operação** com labels PT-PT:
   - Consultar (select)
   - Inserir (insert)
   - Actualizar (update)
   - Inserir/Actualizar (upsert)
   - Remover (delete)
   - Função (rpc)

2. **Campos dinâmicos** conforme operação seleccionada:

   **Para select/update/delete:**
   - Input "Tabela" (texto livre — o utilizador escreve o nome da tabela)
   - Input "Colunas" (só para select, default "*")
   - Lista dinâmica de filtros: cada filtro = `[coluna] [operador ▼] [valor]`
     - Operadores: `=`, `≠`, `>`, `<`, `≥`, `≤`, `contém`, `é nulo`
     - O valor pode ser texto livre ou `{{variável}}` (botão variable picker ao lado)
   - Checkbox "Resultado único" (`.single()`)
   - Input "Limite" (número, só para select)
   - Botão "+ Filtro"

   **Para insert/upsert:**
   - Input "Tabela"
   - Lista dinâmica de dados: `[coluna] = [valor ou {{variável}}]`
   - Input "Conflito" (só para upsert, ex: "task_id,list_id")
   - Botão "+ Campo"

   **Para rpc:**
   - Input "Nome da função" (texto livre)
   - Lista dinâmica de parâmetros: `[nome] = [valor ou {{variável}}]` + select de tipo (text/uuid/int/jsonb)
   - Botão "+ Parâmetro"

3. **Input "Guardar resultado em"** — nome da variável de saída (ex: "query_result")

4. **Botão "Guardar"** que chama `updateNodeData(id, { ...data, ...formState })` e fecha a Sheet

**Padrão a seguir:** O `store-node.tsx` do repositório LeveMãe (enviado anteriormente) usa exactamente este padrão: Sheet com formulário dinâmico, combobox pesquisável, save automático via `useFlowSave()`. Adaptar esse padrão.

**Tipo de dados (já existe em `lib/types/automation-flow.ts`):**
```typescript
interface SupabaseQueryNodeData {
  type: "supabase_query"
  operation: "select" | "insert" | "update" | "upsert" | "delete" | "rpc"
  table?: string
  columns?: string
  filters?: Array<{ column: string; operator: string; value: string }>
  data?: Array<{ column: string; value: string }>
  upsertConflict?: string
  limit?: number
  single?: boolean
  rpcFunction?: string
  rpcParams?: Array<{ name: string; value: string; type?: string }>
  outputVariable?: string
}
```

---

### P2. WhatsApp Node — Selecção de Template

**Ficheiro:** `components/automations/nodes/whatsapp-node.tsx`

**Estado actual:** Mostra contagem de mensagens ou nome de template, mas o select NÃO está conectado à API.

**O que implementar:**

1. Adicionar modo toggle: "Template" vs "Inline"

2. **Modo Template:**
   - Select/Combobox pesquisável que carrega templates de `GET /api/automacao/templates-wpp?active=true`
   - Ao selecionar, guardar `templateId` e `templateName` no node data
   - Mostrar preview: contagem de mensagens + ícones dos tipos (📝 🖼️ 📄)
   - Botão "Ver template" que abre nova tab para o editor do template

3. **Modo Inline:**
   - Reutilizar os componentes `wpp-message-card.tsx` e `wpp-message-editor.tsx` já criados na F4
   - Lista de mensagens com drag-and-drop
   - Botão "+ Mensagem" que abre Sheet do `wpp-message-editor`

4. Guardar em `data.messages` (inline) ou `data.templateId` + `data.templateName` (template)

**Fetch de templates (no componente ou hook):**
```typescript
useEffect(() => {
  if (!isSheetOpen) return
  fetch("/api/automacao/templates-wpp?active=true")
    .then(res => res.json())
    .then(data => setTemplates(data.templates || []))
}, [isSheetOpen])
```

---

### P3. Email Node — Selecção de Template

**Ficheiro:** `components/automations/nodes/email-node.tsx`

**Estado actual:** Mostra nome de template ou assunto, sem select conectado.

**O que implementar:**

1. Modo toggle: "Template da biblioteca" vs "Criar neste fluxo"

2. **Modo Template:**
   - Select que carrega de `tpl_email_library` (tabela existente)
   - API: `GET /api/automacao/email-templates` (CRIAR — query simples ao `tpl_email_library`)
   - Mostrar: nome + assunto do template seleccionado
   - Guardar `emailTemplateId` e `emailTemplateName` no node data

3. **Modo Inline:**
   - Input "Assunto" com variable picker
   - Textarea ou editor para body (pode ser textarea simples com `{{variáveis}}` nesta iteração)
   - Guardar `subject` e `bodyHtml` no node data

4. **Input "Destinatário"**: Variable picker para selecionar variável de email (ex: `lead_email`)

**API route nova a criar:**
```typescript
// app/api/automacao/email-templates/route.ts
// GET — lista templates de email da tpl_email_library
export async function GET() {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from("tpl_email_library")
    .select("id, name, subject, description")
    .order("name")
  return NextResponse.json({ templates: data || [] })
}
```

---

## 🟠 PRIORIDADE MÉDIA — UX do Editor (F5)

### P4. Botão Auto-Layout no Toolbar

**Ficheiro:** `app/dashboard/automacao/fluxos/editor/page.tsx` ou `components/automations/flow-editor.tsx`

**Estado actual:** Hook `use-auto-layout.ts` existe e funciona, mas não há botão na UI.

**O que implementar:**

Adicionar botão no toolbar do editor (ao lado de "Guardar"):

```tsx
import { LayoutGrid } from "lucide-react"
import { useAutoLayout } from "@/hooks/use-auto-layout"

// Dentro do componente:
const { layoutNodes } = useAutoLayout()

const handleAutoLayout = useCallback(() => {
  const layouted = layoutNodes(nodes, edges)
  setNodes(layouted)
  // Opcionalmente: fitView() após layout
  setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 100)
}, [nodes, edges, layoutNodes, setNodes])

// No toolbar:
<Button variant="outline" size="sm" onClick={handleAutoLayout}>
  <LayoutGrid className="h-4 w-4 mr-2" />
  Organizar
</Button>
```

---

### P5. Webhook Listener no Trigger Node (Countdown 120s)

**Ficheiro:** `components/automations/nodes/trigger-webhook-node.tsx`

**Estado actual:** Mostra URL copiável mas SEM botão "Ouvir Webhook".

**O que implementar:**

1. Criar hook `hooks/use-webhook-test-listener.ts` (spec completa no SPEC-AUTO-F2):
   - `startListening(webhookKey)` → subscription Realtime em `auto_webhook_captures` filtrada por `source_id`
   - Countdown visual de 120s
   - Ao receber payload → mostrar JSON tree
   - Timeout → mensagem "Nenhum webhook recebido"
   - Cleanup ao desmontar

2. No trigger-webhook-node, adicionar estados visuais:
   - **Idle:** Botão "Ouvir Webhook"
   - **Listening:** Indicador pulsante 🟡 + countdown + "Parar"
   - **Received:** JSON tree do payload + botão "Usar como exemplo"
   - **Timeout:** "Nenhum recebido em 120s" + "Tentar novamente"

3. Componentes auxiliares a criar:
   - `components/automations/webhook-json-tree.tsx` — Tree colapsável do payload
   - `components/automations/webhook-field-mapper.tsx` — Mapeamento path → variável

**Dependência:** Realtime na tabela `auto_webhook_captures` (já habilitado na F1).

**Dependência:** O webhook receiver (`app/api/webhook/[key]/route.ts`) precisa existir para aceitar POSTs e gravar na `auto_webhook_captures`. Este receiver será criado na F6, MAS pode-se criar uma versão mínima agora que apenas grava o payload:

```typescript
// app/api/webhook/[key]/route.ts (versão mínima para teste)
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const supabase = createAdminSupabaseClient()
  const { key } = await params
  const payload = await request.json()

  // Buscar trigger (sem filtro active — para teste funcionar)
  const { data: trigger } = await supabase
    .from("auto_triggers")
    .select("flow_id, auto_flows!inner(name)")
    .eq("trigger_source", key)
    .eq("source_type", "webhook")
    .single()

  // Gravar para inspeção (Realtime notifica o listener no editor)
  await supabase.from("auto_webhook_captures").upsert({
    source_id: key,
    flow_name: (trigger?.auto_flows as any)?.name || "Desconhecido",
    payload,
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, mode: trigger ? "captured" : "unknown_key" })
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Webhook endpoint activo" })
}
```

---

## 🟡 PRIORIDADE BAIXA — Polish e UX

### P6. Preview WhatsApp com Dropdown de Lead Real

**Ficheiro:** `components/automations/wpp-template-builder.tsx`

**Estado actual:** Usa `SAMPLE_VALUES` hardcoded.

**O que implementar:**

Adicionar Select acima do preview:

```tsx
// Buscar últimos 20 leads para o dropdown
const [leads, setLeads] = useState([])
useEffect(() => {
  fetch("/api/leads?limit=20&fields=id,nome,email,telefone,telemovel,origem,estado,temperatura")
    .then(res => res.json())
    .then(data => setLeads(data.leads || []))
}, [])

// Select no preview
<Select value={selectedLeadId} onValueChange={handleLeadChange}>
  <SelectTrigger>
    <SelectValue placeholder="Pré-visualizar com..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="sample">Dados de exemplo</SelectItem>
    {leads.map(lead => (
      <SelectItem key={lead.id} value={lead.id}>
        {lead.nome} ({lead.email})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Ao selecionar um lead, mapear os campos para variáveis e passar ao preview.

**Nota:** Se a API `/api/leads` não existir ainda, criar uma versão simples que faz `SELECT id, nome, email, telefone FROM leads LIMIT 20`.

---

### P7. Tradução de Cron para PT-PT

**Ficheiro:** `components/automations/nodes/trigger-schedule-node.tsx`

**O que implementar:**

Mostrar descrição legível por baixo do input cron:

```typescript
function describeCron(expression: string): string {
  const parts = expression.split(" ")
  if (parts.length !== 5) return "Expressão inválida"
  const [min, hour, dom, mon, dow] = parts

  // Casos comuns
  if (expression === "* * * * *") return "A cada minuto"
  if (min === "0" && hour === "9" && dom === "*" && mon === "*" && dow === "1-5")
    return "Todos os dias úteis às 9:00"
  if (min === "0" && hour === "9" && dom === "*" && mon === "*" && dow === "*")
    return "Todos os dias às 9:00"
  if (min.startsWith("*/")) return `A cada ${min.slice(2)} minutos`
  if (hour !== "*" && min !== "*" && dow === "*")
    return `Todos os dias às ${hour}:${min.padStart(2, "0")}`
  if (hour !== "*" && min !== "*" && dow === "1-5")
    return `Seg a Sex às ${hour}:${min.padStart(2, "0")}`
  if (hour !== "*" && min !== "*" && dow === "1")
    return `Todas as segundas às ${hour}:${min.padStart(2, "0")}`

  return `Cron: ${expression}`
}
```

---

### P8. Validação Avançada antes de Guardar

**Ficheiro:** `components/automations/flow-editor.tsx` (no handleSave)

**O que implementar:**

Antes de guardar, verificar:

```typescript
function validateFlow(nodes, edges): string[] {
  const errors: string[] = []

  // 1. Pelo menos 1 trigger
  const triggers = nodes.filter(n => n.type?.startsWith("trigger_"))
  if (triggers.length === 0) errors.push("O fluxo precisa de pelo menos um gatilho")

  // 2. Trigger deve ter configuração
  for (const t of triggers) {
    if (t.type === "trigger_webhook" && !t.data.webhookKey)
      errors.push("Gatilho Webhook sem chave configurada")
    if (t.type === "trigger_status" && !t.data.triggerCondition?.entity_type)
      errors.push("Gatilho Status sem entidade configurada")
    if (t.type === "trigger_schedule" && !t.data.cronExpression)
      errors.push("Gatilho Agendamento sem expressão cron")
  }

  // 3. WhatsApp node deve ter instância
  const wppNodes = nodes.filter(n => n.type === "whatsapp")
  if (wppNodes.length > 0 && !wppInstanceId)
    errors.push("Nodes WhatsApp requerem uma instância seleccionada")

  // 4. Nodes WhatsApp devem ter mensagens ou template
  for (const n of wppNodes) {
    if (!n.data.templateId && (!n.data.messages || n.data.messages.length === 0))
      errors.push(`Node WhatsApp "${n.data.label}" sem mensagens configuradas`)
  }

  // 5. Condition node deve ter pelo menos 1 regra
  for (const n of nodes.filter(n => n.type === "condition")) {
    if (!n.data.rules || n.data.rules.length === 0)
      errors.push(`Condição "${n.data.label}" sem regras definidas`)
  }

  // 6. Todos os nodes devem estar conectados
  const connectedIds = new Set([...edges.map(e => e.source), ...edges.map(e => e.target)])
  const triggerIds = new Set(triggers.map(t => t.id))
  for (const n of nodes) {
    if (!triggerIds.has(n.id) && !connectedIds.has(n.id))
      errors.push(`Node "${n.data.label || n.type}" não está conectado`)
  }

  return errors
}

// No handleSave:
const errors = validateFlow(nodes, edges)
if (errors.length > 0) {
  errors.forEach(e => toast.error(e))
  return
}
```

---

## 📋 Ordem de Implementação Recomendada

| # | Item | Prioridade | Ficheiros | Bloqueia F6? |
|---|------|-----------|-----------|-------------|
| 1 | P1: Sheet Supabase Query Node | 🔴 Alta | supabase-query-node.tsx | Sim |
| 2 | P2: WhatsApp Node template select | 🔴 Alta | whatsapp-node.tsx | Sim |
| 3 | P3: Email Node template select | 🔴 Alta | email-node.tsx + nova API route | Sim |
| 4 | P4: Botão Auto-Layout | 🟠 Média | flow-editor.tsx | Não |
| 5 | P8: Validação antes de guardar | 🟠 Média | flow-editor.tsx | Não |
| 6 | P5: Webhook Listener | 🟠 Média | trigger-webhook-node.tsx + hook + route | Parcial |
| 7 | P6: Preview com lead real | 🟡 Baixa | wpp-template-builder.tsx | Não |
| 8 | P7: Tradução cron | 🟡 Baixa | trigger-schedule-node.tsx | Não |

**Recomendação:** Implementar P1, P2 e P3 primeiro — são os que bloqueiam a F6 (Motor de Execução). Os restantes podem ser feitos em paralelo ou depois da F6.
