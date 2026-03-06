# SPEC-AUTO-DRAFT-PUBLISH — Auto-Save, Draft/Publicação e Webhooks Inutilizados

**Data:** 2026-03-06
**Status:** 🔵 A IMPLEMENTAR
**Migrations aplicadas:** ✅ `auto_add_draft_published_flow`, `auto_update_version_trigger_for_draft`

---

## 📋 Conceito

O fluxo tem 2 versões:

| Versão | Coluna | Quem usa | Quando muda |
|--------|--------|----------|-------------|
| **Draft** | `draft_definition` | Editor + Testes | Auto-save contínuo |
| **Publicada** | `published_definition` | Webhooks + Crons + Produção | Só quando o utilizador clica "Publicar" |

**Regras:**
1. **Auto-save:** O editor guarda em `draft_definition` automaticamente (debounce 2-3s após alteração)
2. **Botão "Guardar" desaparece** — substituído por indicador "Guardado" / "A guardar..."
3. **Botão "Publicar" novo** — copia `draft_definition` → `published_definition` + sincroniza triggers
4. **Testes usam SEMPRE `draft_definition`** — permite testar antes de publicar
5. **Produção usa SEMPRE `published_definition`** — webhook receiver e worker só lêem esta
6. **`is_active` só funciona se `published_definition` não é null** — não podes activar sem publicar
7. **Webhooks de fluxos não publicados/desactivados** retornam 404 ou 410

---

## 📊 Alterações no Banco (JÁ APLICADAS)

```
auto_flows
├── draft_definition JSONB NOT NULL    ← era flow_definition (RENOMEADA)
├── published_definition JSONB         ← NOVA (null se nunca publicado)
├── published_at TIMESTAMPTZ           ← NOVA
├── published_by UUID → dev_users      ← NOVA
├── published_triggers JSONB           ← NOVA (triggers da versão publicada)
├── is_active BOOLEAN                  ← existente (só funciona com published_definition)
└── ... (restantes colunas iguais)
```

---

## 📁 Ficheiros a Modificar

### 1. API: `app/api/automacao/fluxos/[flowId]/route.ts`

#### GET — Retornar ambas as versões

```typescript
// Response agora inclui:
{
  flow: {
    id, name, description,
    draft_definition,         // Para o editor
    published_definition,     // Para info (pode ser null)
    published_at,
    is_active,
    has_unpublished_changes: boolean,  // draft !== published
    wpp_instance_id,
  },
  triggers: [...]  // Triggers activos (da published)
}
```

Calcular `has_unpublished_changes`:
```typescript
const hasChanges = JSON.stringify(flow.draft_definition) !== JSON.stringify(flow.published_definition)
```

#### PUT — Auto-save (só draft)

O PUT passa a guardar APENAS em `draft_definition`. Não toca em `published_definition` nem em `auto_triggers`.

```typescript
// Body: { draft_definition, name?, description?, wpp_instance_id? }
// NÃO aceita: published_definition, is_active (esses são via acções separadas)

const { data } = await supabase
  .from("auto_flows")
  .update({
    draft_definition: body.draft_definition,
    name: body.name,
    description: body.description,
    wpp_instance_id: body.wpp_instance_id,
    updated_at: new Date().toISOString(),
  })
  .eq("id", flowId)
  .select()
  .single()
```

#### Novo: POST `/api/automacao/fluxos/[flowId]/publish`

Publica o draft para produção:

```typescript
export async function POST(request, { params }) {
  const { flowId } = await params
  const supabase = createAdminSupabaseClient()

  // 1. Buscar o flow
  const { data: flow } = await supabase
    .from("auto_flows")
    .select("draft_definition, wpp_instance_id")
    .eq("id", flowId)
    .single()

  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 })

  const draftDef = flow.draft_definition

  // 2. Validar o draft antes de publicar
  const errors = validateFlowForPublish(draftDef, flow.wpp_instance_id)
  if (errors.length > 0) {
    return NextResponse.json({ error: "Fluxo tem erros", errors }, { status: 422 })
  }

  // 3. Extrair triggers do draft
  const triggers = extractTriggersFromDefinition(draftDef)

  // 4. Publicar: copiar draft → published
  await supabase
    .from("auto_flows")
    .update({
      published_definition: draftDef,
      published_at: new Date().toISOString(),
      published_triggers: triggers,
    })
    .eq("id", flowId)

  // 5. Sincronizar auto_triggers (produção)
  // Apagar triggers antigos
  await supabase
    .from("auto_triggers")
    .delete()
    .eq("flow_id", flowId)

  // Inserir novos da versão publicada
  for (const trigger of triggers) {
    await supabase
      .from("auto_triggers")
      .insert({
        flow_id: flowId,
        source_type: trigger.source_type,
        trigger_source: trigger.trigger_source,
        trigger_condition: trigger.trigger_condition,
        payload_mapping: trigger.payload_mapping,
        active: true,
      })
  }

  return NextResponse.json({
    ok: true,
    published_at: new Date().toISOString(),
    triggers_count: triggers.length,
  })
}

// Extrair triggers dos nodes do draft
function extractTriggersFromDefinition(definition: any) {
  const triggers = []
  for (const node of definition.nodes || []) {
    const d = node.data
    if (d.type === "trigger_webhook" && d.webhookKey) {
      triggers.push({
        source_type: "webhook",
        trigger_source: d.webhookKey,
        payload_mapping: d.webhookMappings || [],
      })
    }
    if (d.type === "trigger_schedule" && d.cronExpression) {
      triggers.push({
        source_type: "schedule",
        trigger_condition: { cron: d.cronExpression, timezone: d.timezone || "Europe/Lisbon" },
      })
    }
    if (d.type === "trigger_status" && d.triggerCondition) {
      triggers.push({
        source_type: "status_change",
        trigger_condition: d.triggerCondition,
      })
    }
    if (d.type === "trigger_manual") {
      triggers.push({ source_type: "manual" })
    }
  }
  return triggers
}
```

#### Novo: POST `/api/automacao/fluxos/[flowId]/activate`

Activar/desactivar fluxo (só funciona se publicado):

```typescript
// Body: { active: boolean }
export async function POST(request, { params }) {
  const { flowId } = await params
  const body = await request.json()
  const supabase = createAdminSupabaseClient()

  if (body.active) {
    // Verificar que tem published_definition
    const { data: flow } = await supabase
      .from("auto_flows")
      .select("published_definition")
      .eq("id", flowId)
      .single()

    if (!flow?.published_definition) {
      return NextResponse.json({
        error: "Impossível activar: o fluxo ainda não foi publicado. Clica em 'Publicar' primeiro."
      }, { status: 422 })
    }
  }

  // Activar/desactivar
  await supabase
    .from("auto_flows")
    .update({ is_active: body.active })
    .eq("id", flowId)

  // Activar/desactivar triggers
  await supabase
    .from("auto_triggers")
    .update({ active: body.active })
    .eq("flow_id", flowId)

  return NextResponse.json({ ok: true, is_active: body.active })
}
```

### 2. Webhook Receiver: `app/api/webhook/[key]/route.ts`

Agora usa `published_definition` e verifica se o fluxo está activo:

```typescript
export async function POST(request, { params }) {
  const { key } = await params
  const payload = await request.json()
  const supabase = createAdminSupabaseClient()

  // 1. Buscar trigger ACTIVO de fluxo ACTIVO com published_definition
  const { data: trigger } = await supabase
    .from("auto_triggers")
    .select("*, auto_flows!inner(id, name, published_definition, wpp_instance_id, is_active)")
    .eq("trigger_source", key)
    .eq("source_type", "webhook")
    .eq("active", true)
    .single()

  // 2. SEMPRE gravar para inspecção (permite teste no editor)
  await supabase.from("auto_webhook_captures").upsert({
    source_id: key,
    flow_name: trigger?.auto_flows?.name || "Desconhecido",
    payload,
    updated_at: new Date().toISOString(),
  })

  // 3. Se não existe trigger activo → 410 Gone
  if (!trigger) {
    return NextResponse.json({
      error: "Webhook não encontrado ou desactivado",
      hint: "Este webhook pode ter sido desactivado ou o fluxo não está publicado."
    }, { status: 410 })
  }

  // 4. Se fluxo não está activo → 422
  if (!trigger.auto_flows.is_active) {
    return NextResponse.json({
      ok: true,
      mode: "inactive",
      message: "Fluxo não está activo. Payload capturado mas não executado."
    })
  }

  // 5. Se não tem published_definition → 422
  if (!trigger.auto_flows.published_definition) {
    return NextResponse.json({
      ok: true,
      mode: "unpublished",
      message: "Fluxo não publicado. Payload capturado mas não executado."
    })
  }

  // 6. Executar com published_definition (NÃO draft)
  const flowDef = trigger.auto_flows.published_definition
  // ... resto da execução igual ao actual, mas usando flowDef da published
}
```

### 3. Test Route: `app/api/automacao/fluxos/[flowId]/test/route.ts`

Testes usam SEMPRE `draft_definition`:

```typescript
// Buscar flow
const { data: flow } = await supabase
  .from("auto_flows")
  .select("draft_definition, wpp_instance_id")  // ← DRAFT, não published
  .eq("id", flowId)
  .single()

const flowDef = flow.draft_definition  // ← Testar o rascunho
```

### 4. Worker: `app/api/automacao/worker/route.ts`

O worker usa `published_definition`:

```typescript
// Ao processar step, buscar flow
const { data: flow } = await supabase
  .from("auto_flows")
  .select("published_definition, wpp_instance_id")  // ← PUBLISHED
  .eq("id", step.flow_id)
  .single()

const flowDef = flow.published_definition  // ← Produção
```

### 5. Editor Page: `app/dashboard/automacao/fluxos/editor/page.tsx`

**Grandes mudanças na UX:**

#### Remover botão "Guardar" → Indicador de estado

```
ACTUAL:   [Testar] [Guardar 💾]
NOVO:     [Testar] [Publicar 🚀]  ☁️ Guardado automaticamente
```

Estados do indicador:
- `☁️ Guardado` — draft sincronizado
- `⏳ A guardar...` — debounce activo
- `⚠️ Erro ao guardar` — retry automático

#### Auto-save com debounce

```typescript
// Hook ou useEffect no editor:
const saveTimeoutRef = useRef<NodeJS.Timeout>()
const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved")

// Quando nodes ou edges mudam:
const handleFlowChange = useCallback((definition: FlowDefinition) => {
  setSaveStatus("saving")

  // Cancelar save anterior
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

  // Debounce de 2 segundos
  saveTimeoutRef.current = setTimeout(async () => {
    try {
      await updateFlow(flowId, { draft_definition: definition })
      setSaveStatus("saved")
    } catch {
      setSaveStatus("error")
      // Retry após 5s
      setTimeout(() => handleFlowChange(definition), 5000)
    }
  }, 2000)
}, [flowId])
```

#### Botão "Publicar"

```typescript
const handlePublish = async () => {
  const res = await fetch(`/api/automacao/fluxos/${flowId}/publish`, { method: "POST" })
  const data = await res.json()

  if (!res.ok) {
    if (data.errors) {
      data.errors.forEach((e: string) => toast.error(e))
    } else {
      toast.error(data.error || "Erro ao publicar")
    }
    return
  }

  toast.success("Fluxo publicado!", {
    description: `${data.triggers_count} gatilho(s) sincronizado(s)`
  })
  setHasUnpublishedChanges(false)
}
```

#### Badge visual de estado no editor

```
[Se draft === published:]
🟢 Publicado

[Se draft !== published:]
🟡 Alterações não publicadas

[Se published_definition === null:]
⚪ Nunca publicado
```

### 6. Listagem: `app/dashboard/automacao/fluxos/page.tsx`

Cada card mostra estado de publicação:

```
┌──────────────────────────────────────┐
│ 📋 Boas-vindas Lead                  │
│ 🟢 Publicado · Activo                │  ← published + is_active
│ Última publicação: há 2 horas        │
│                                      │
│ 📋 Follow-up 3 dias                  │
│ 🟡 Alterações não publicadas          │  ← draft ≠ published
│                                      │
│ 📋 Novo Fluxo                        │
│ ⚪ Rascunho · Nunca publicado         │  ← published = null
└──────────────────────────────────────┘
```

Toggle de activar/desactivar:
- Se `published_definition` existe → toggle funciona
- Se `published_definition` é null → toggle desabilitado com tooltip "Publica o fluxo primeiro"

---

## 🔒 Webhooks Inutilizados

### Problema

Quando um fluxo é desactivado ou eliminado, o webhook key (`/api/webhook/418d012895bc49b1`) continua acessível. Qualquer pessoa com o URL pode enviar dados.

### Solução

O webhook receiver já foi actualizado acima para verificar:

1. **Trigger existe e está activo?** → Se não: `410 Gone`
2. **Fluxo está activo (`is_active`)?** → Se não: captura payload mas não executa
3. **Fluxo tem `published_definition`?** → Se não: captura mas não executa

Adicionalmente:

### Ao desactivar fluxo

A route `/api/automacao/fluxos/[flowId]/activate` com `active: false`:
- Marca `is_active = false` no fluxo
- Marca `active = false` em TODOS os `auto_triggers` do fluxo
- Webhooks passam a retornar "Fluxo não está activo"

### Ao eliminar fluxo

O DELETE já tem `CASCADE` — apagar `auto_flows` remove automaticamente `auto_triggers`. O webhook retorna 410.

### Ao despublicar (rollback)

Criar acção opcional que limpa `published_definition`:

```typescript
// POST /api/automacao/fluxos/[flowId]/unpublish
await supabase.from("auto_flows").update({
  published_definition: null,
  published_triggers: null,
  published_at: null,
  is_active: false,
}).eq("id", flowId)

// Remover triggers de produção
await supabase.from("auto_triggers").delete().eq("flow_id", flowId)
```

---

## 📋 Resumo das API Routes

| Route | Método | Acção |
|-------|--------|-------|
| `/api/automacao/fluxos/[flowId]` | GET | Retorna draft + published + estado |
| `/api/automacao/fluxos/[flowId]` | PUT | Auto-save draft (NÃO toca published) |
| `/api/automacao/fluxos/[flowId]/publish` | POST | **NOVO** — Copia draft → published, sincroniza triggers |
| `/api/automacao/fluxos/[flowId]/activate` | POST | **NOVO** — Activa/desactiva (requer published) |
| `/api/automacao/fluxos/[flowId]/unpublish` | POST | **NOVO** — Remove published, desactiva |
| `/api/automacao/fluxos/[flowId]/test` | POST | Testa usando DRAFT |
| `/api/webhook/[key]` | POST | Executa usando PUBLISHED (410 se inactivo) |
| `/api/automacao/worker` | POST | Processa usando PUBLISHED |

## Busca local antes de implementar

```bash
# Ver todos os ficheiros que referenciam flow_definition (precisa de mudar para draft_definition)
grep -rn "flow_definition" app/ components/ hooks/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"

# Ver o editor page
cat app/dashboard/automacao/fluxos/editor/page.tsx

# Ver a listagem
cat app/dashboard/automacao/fluxos/page.tsx

# Ver o webhook receiver
cat app/api/webhook/*/route.ts 2>/dev/null

# Ver o worker
cat app/api/automacao/worker/route.ts

# Ver o hook de flows
cat hooks/use-flows.ts
```

**CRÍTICO:** Todos os ficheiros que referenciam `flow_definition` precisam de ser actualizados para `draft_definition` (editor, hooks) ou `published_definition` (webhook, worker).

## Ordem de implementação

1. **grep e substituir** `flow_definition` → `draft_definition` em todos os ficheiros do editor/hooks
2. **Criar** route `publish`
3. **Criar** route `activate`
4. **Modificar** webhook receiver para usar `published_definition`
5. **Modificar** worker para usar `published_definition`
6. **Modificar** test route para usar `draft_definition`
7. **Modificar** editor page: auto-save + botão publicar + indicador
8. **Modificar** listagem: badges de estado
