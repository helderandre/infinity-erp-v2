# SPEC-AUTO-F6-MOTOR-EXECUCAO — Fase 6: Motor de Execução

**Data:** 2026-03-05
**Prioridade:** 🟡 Média (necessita F1, F2, F5)
**Estimativa:** 3-4 sessões de Claude Code
**Pré-requisitos:** F1 (DB + pgmq), F2 (tipos + engines), F5 (editor com flows salvos)

---

## 📋 Objectivo

Criar o motor que executa os fluxos de automação: Edge Function worker que processa a fila pgmq, executor síncrono para webhooks com resposta imediata, webhook receiver, e processamento de cada tipo de node. Suporta execução síncrona, assíncrona, e híbrida.

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| **Edge Functions (Supabase)** | |
| `supabase/functions/auto-worker/index.ts` | Worker que processa fila pgmq |
| **API Routes** | |
| `app/api/webhook/[key]/route.ts` | Receiver de webhooks externos |
| **Lib** | |
| `lib/sync-flow-executor.ts` | Engine de execução síncrona (inline) |
| `lib/node-processors/index.ts` | Registry de processadores por tipo |
| `lib/node-processors/whatsapp.ts` | Processador WhatsApp (envia via Uazapi) |
| `lib/node-processors/email.ts` | Processador Email (envia via Resend) |
| `lib/node-processors/condition.ts` | Avalia condição e retorna handle |
| `lib/node-processors/supabase-query.ts` | Executa operação no Supabase |
| `lib/node-processors/task-lookup.ts` | Busca/cria entidade |
| `lib/node-processors/delay.ts` | Calcula scheduled_for futuro |
| `lib/node-processors/set-variable.ts` | Define variáveis no contexto |
| `lib/node-processors/http-request.ts` | Chamada HTTP externa |
| `lib/node-processors/webhook-response.ts` | Retorna resposta ao caller |
| `lib/node-processors/notification.ts` | Cria notificação no sistema |

---

## 🏗️ Arquitectura dos 3 Modos de Execução

### Modo 1: Assíncrono (padrão)

```
Trigger dispara → INSERT auto_runs + primeiro auto_step_runs
  → pg_cron invoca Edge Function a cada minuto
  → Edge Function: pgmq.read() ou auto_claim_steps()
  → Processa node → INSERT próximo step → Repete até fim
```

**Quando usar:** Fluxos com WhatsApp, Email, Delay, ou qualquer operação demorada.

### Modo 2: Síncrono (webhook com resposta)

```
Webhook POST → Detecta node "Responder Webhook" no fluxo
  → SyncFlowExecutor percorre nodes inline (sem fila)
  → Ao chegar no Webhook Response: retorna HTTP response ao caller
  → Se "continuar após responder": insere nodes restantes na fila assíncrona
```

**Quando usar:** Formulários que precisam de resposta imediata (task_id, dados).

### Modo 3: Híbrido (Next.js `after()`)

```
Webhook POST → Executa nodes rápidos inline (Condition, Supabase Query, etc.)
  → Retorna resposta via Webhook Response node
  → after(): insere nodes restantes (WhatsApp, Email) na fila
```

**Quando usar:** Resposta rápida + processamento posterior.

---

## ⚙️ Edge Function Worker: `auto-worker/index.ts`

### Ciclo principal

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // 1. Reclamar batch de steps pendentes
  const { data: steps } = await supabase.rpc("auto_claim_steps", { batch_size: 5 })
  if (!steps || steps.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }))
  }

  let processed = 0

  for (const step of steps) {
    try {
      // 2. Buscar flow_definition
      const { data: flow } = await supabase
        .from("auto_flows").select("flow_definition, wpp_instance_id")
        .eq("id", step.flow_id).single()

      // 3. Buscar contexto do run
      const { data: run } = await supabase
        .from("auto_runs").select("context")
        .eq("id", step.run_id).single()

      // 4. Encontrar dados do node
      const flowDef = flow.flow_definition as FlowDefinition
      const node = flowDef.nodes.find(n => n.id === step.node_id)
      if (!node) throw new Error(`Node ${step.node_id} não encontrado`)

      // 5. Processar node
      const result = await processNode(supabase, node, step, run.context, flow)

      // 6. Marcar step como completo
      await supabase.from("auto_step_runs").update({
        status: "completed",
        output_data: result.output,
        completed_at: new Date().toISOString(),
        duration_ms: result.durationMs,
      }).eq("id", step.id)

      // 7. Encontrar e enfileirar próximo(s) node(s)
      const nextEdges = flowDef.edges.filter(e => {
        if (e.source !== step.node_id) return false
        // Se node tem handle específico (condition, task_lookup)
        if (result.nextHandle && e.sourceHandle) return e.sourceHandle === result.nextHandle
        if (result.nextHandle && !e.sourceHandle) return false
        return true
      })

      for (const edge of nextEdges) {
        const nextNode = flowDef.nodes.find(n => n.id === edge.target)
        await supabase.from("auto_step_runs").insert({
          run_id: step.run_id,
          flow_id: step.flow_id,
          node_id: edge.target,
          node_type: nextNode?.type || "unknown",
          node_label: (nextNode?.data as Record<string,unknown>)?.label as string || "",
          status: "pending",
          scheduled_for: result.scheduledFor || new Date().toISOString(),
          priority: step.priority,
          input_data: { ...run.context, ...result.contextUpdates },
        })
      }

      // 8. Se não há próximos → run completo
      if (nextEdges.length === 0) {
        await updateRunCompletion(supabase, step.run_id)
      }

      // 9. Actualizar contadores do run
      await supabase.rpc("auto_update_run_counts", { p_run_id: step.run_id })

      processed++
    } catch (error) {
      // Falha: registar erro e verificar retry
      const retryCount = (step.retry_count || 0) + 1
      const maxRetries = step.max_retries || 3

      if (retryCount < maxRetries) {
        const nextRetryAt = calculateNextRetryAt(retryCount)
        await supabase.from("auto_step_runs").update({
          status: "pending",
          retry_count: retryCount,
          scheduled_for: nextRetryAt.toISOString(),
          error_message: error.message,
        }).eq("id", step.id)
      } else {
        await supabase.from("auto_step_runs").update({
          status: "failed",
          retry_count: retryCount,
          completed_at: new Date().toISOString(),
          error_message: `Falhou após ${maxRetries} tentativas: ${error.message}`,
        }).eq("id", step.id)
        await updateRunCompletion(supabase, step.run_id)
      }
    }
  }

  return new Response(JSON.stringify({ processed }))
})
```

---

## 🔧 Processadores de Node (`lib/node-processors/`)

### Interface comum

```typescript
interface NodeProcessResult {
  output?: Record<string, unknown>     // Dados de saída do node
  contextUpdates?: Record<string, string>  // Variáveis a adicionar ao contexto
  nextHandle?: string                  // "true"/"false" para condition, "found"/"created" para lookup
  scheduledFor?: string                // ISO timestamp para delay nodes
  durationMs?: number
  deliveries?: DeliveryEntry[]         // Para log de entregas (WhatsApp, Email)
}
```

### `whatsapp.ts` — Envio WhatsApp via Uazapi

```typescript
// 1. Buscar instância WhatsApp do fluxo
// 2. Resolver variáveis no conteúdo de cada mensagem
// 3. Para cada mensagem da sequência:
//    a. Se type=text: POST /send/text { number, text, delay }
//    b. Se type=image/video/audio/document: POST /send/media { number, type, file, text, docName, delay }
//    c. Registar em auto_delivery_log
//    d. Respeitar delay entre mensagens (mínimo 1.5s)
// 4. Se templateId: buscar messages do auto_wpp_templates
// 5. Retornar output com message_ids
```

**Rate limiting:**
- Mínimo 1500ms entre mensagens para o mesmo destinatário
- Campo `delay` da Uazapi mostra "digitando..." antes de enviar
- `track_source: "erp_infinity"` e `track_id: run_id` para rastreamento

### `email.ts` — Envio Email via Resend

```typescript
// 1. Se emailTemplateId: buscar de tpl_email_library
// 2. Resolver variáveis no subject e body_html
// 3. Enviar via Resend API
// 4. Registar em auto_delivery_log e log_emails (tabela existente)
```

### `condition.ts` — Avaliação de Condição

```typescript
// 1. Extrair rules e logic do node data
// 2. Chamar evaluateCondition(rules, logic, context.variables)
// 3. Retornar nextHandle: result ? "true" : "false"
// Sem side effects — apenas routing
```

### `supabase-query.ts` — Operação no Banco

```typescript
// 1. Resolver variáveis em todos os campos (filters, data, rpcParams)
// 2. Executar operação conforme type:
//    - select: supabase.from(table).select(columns).filters...
//    - insert: supabase.from(table).insert(data).select()
//    - update: supabase.from(table).update(data).filters...
//    - upsert: supabase.from(table).upsert(data, {onConflict}).select()
//    - delete: supabase.from(table).delete().filters...
//    - rpc: supabase.rpc(functionName, params)
// 3. Guardar resultado em context[outputVariable]
```

### `task-lookup.ts` — Buscar/Criar Entidade

```typescript
// 1. Resolver variável de lookup
// 2. Buscar na tabela (leads, owners, users) pelo campo configurado
// 3. Se encontrou: nextHandle = "found", context[outputVar] = entity.id
// 4. Se não encontrou e createIfNotFound:
//    a. Inserir com initialFields resolvidas
//    b. nextHandle = "created"
// 5. Se não encontrou e !createIfNotFound: nextHandle = "error"
```

### `delay.ts` — Agendar para o Futuro

```typescript
// 1. Calcular scheduledFor = now + value * unit
// 2. Retornar scheduledFor para o worker inserir no próximo step
// O step fica como "pending" com scheduled_for no futuro
// O cron do worker só o reclama quando scheduled_for <= now()
```

### `webhook-response.ts` — Responder Webhook

```typescript
// NOTA: Este processador só é usado no modo ASSÍNCRONO (fallback)
// No modo síncrono, o SyncFlowExecutor trata dele directamente
// 1. Resolver variáveis no responseBody
// 2. Guardar resposta no output (para histórico)
// 3. Se continueAfterResponse: fluxo continua
// 4. Se não: fluxo termina aqui
```

---

## 🔗 Webhook Receiver: `app/api/webhook/[key]/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const supabase = createAdminSupabaseClient()
  const { key } = await params
  const payload = await request.json()

  // 1. Buscar trigger (SEM filtro active — para suportar teste)
  const { data: trigger } = await supabase
    .from("auto_triggers")
    .select("*, auto_flows!inner(*)")
    .eq("trigger_source", key)
    .eq("source_type", "webhook")
    .single()

  if (!trigger) return NextResponse.json({ error: "Webhook not found" }, { status: 404 })

  // 2. SEMPRE salvar para inspecção (permite listener funcionar)
  await supabase.from("auto_webhook_captures").upsert({
    source_id: key,
    flow_name: trigger.auto_flows.name,
    payload,
    updated_at: new Date().toISOString(),
  })

  // 3. Se trigger não activo → modo teste
  if (!trigger.active) {
    return NextResponse.json({ ok: true, mode: "test", message: "Payload capturado para teste" })
  }

  // 4. Resolver mapeamento de payload
  const mappings = trigger.payload_mapping || []
  const mappedVariables = resolveWebhookMapping(payload, mappings)

  // 5. Detectar se fluxo tem Webhook Response node → modo síncrono
  const flowDef = trigger.auto_flows.flow_definition as FlowDefinition
  const hasWebhookResponse = flowDef.nodes.some(n => (n.data as any).type === "webhook_response")

  if (hasWebhookResponse) {
    // MODO SÍNCRONO
    const executor = new SyncFlowExecutor(supabase, flowDef, {
      webhook_payload: payload,
      variables: mappedVariables,
    })
    const result = await executor.run()

    // Enfileirar nodes assíncronos restantes
    if (result.asyncNodes.length > 0) {
      const runId = await createAsyncRun(supabase, trigger, result)
      // Inserir steps assíncronos
      for (const node of result.asyncNodes) {
        await supabase.from("auto_step_runs").insert({
          run_id: runId, flow_id: trigger.flow_id,
          node_id: node.id, node_type: node.type, node_label: node.label,
          status: "pending", scheduled_for: node.scheduledFor || new Date().toISOString(),
          input_data: result.context,
        })
      }
    }

    return NextResponse.json(result.response.body, { status: result.response.statusCode })
  }

  // MODO ASSÍNCRONO (padrão)
  const runId = crypto.randomUUID()
  const triggerNode = flowDef.nodes.find(n => (n.data as any).type?.startsWith("trigger_"))
  const firstEdge = flowDef.edges.find(e => e.source === triggerNode?.id)
  if (!firstEdge) return NextResponse.json({ error: "Fluxo sem nodes após trigger" }, { status: 422 })

  // Criar run
  await supabase.from("auto_runs").insert({
    id: runId, flow_id: trigger.flow_id, trigger_id: trigger.id,
    triggered_by: "webhook", status: "running",
    context: { webhook_payload: payload, variables: mappedVariables },
    started_at: new Date().toISOString(),
  })

  // Criar primeiro step
  const firstNode = flowDef.nodes.find(n => n.id === firstEdge.target)
  await supabase.from("auto_step_runs").insert({
    run_id: runId, flow_id: trigger.flow_id,
    node_id: firstEdge.target, node_type: firstNode?.type || "unknown",
    node_label: (firstNode?.data as any)?.label || "",
    status: "pending", scheduled_for: new Date().toISOString(), priority: 5,
    input_data: { webhook_payload: payload, variables: mappedVariables },
  })

  return NextResponse.json({ ok: true, run_id: runId })
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Webhook endpoint activo" })
}
```

---

## 🔄 SyncFlowExecutor: `lib/sync-flow-executor.ts`

Engine que percorre o grafo executando nodes inline (sem fila) até encontrar um Webhook Response node.

```typescript
export class SyncFlowExecutor {
  // Percorre o grafo em sequência:
  // 1. Encontrar trigger node → seguir primeira edge
  // 2. Para cada node:
  //    - Se Condition: avaliar e seguir handle correcto
  //    - Se Task Lookup: buscar/criar e seguir handle
  //    - Se Supabase Query: executar e continuar
  //    - Se Set Variable: definir e continuar
  //    - Se Webhook Response: PARAR e retornar response
  //    - Se WhatsApp/Email/Delay: marcar como "assíncrono" e parar percurso
  // 3. Retornar { response, context, asyncNodes }

  async run(): Promise<SyncExecutionResult> {
    // Encontrar trigger → primeira edge → percorrer
    // Timeout de 25 segundos (margem para o timeout do serverless)
    // Se exceder, retornar erro 504
  }
}

interface SyncExecutionResult {
  response: { statusCode: number; body: unknown }
  context: Record<string, unknown>
  asyncNodes: Array<{ id: string; type: string; label: string; scheduledFor?: string }>
}
```

---

## 📦 Migration SQL adicional: Função de contagem

```sql
-- Migration: auto_create_run_counts_function

CREATE OR REPLACE FUNCTION auto_update_run_counts(p_run_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE auto_runs SET
    total_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id),
    completed_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'completed'),
    failed_steps = (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'failed'),
    status = CASE
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status = 'failed') > 0 THEN 'failed'::auto_run_status
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status IN ('pending','running')) > 0 THEN 'running'::auto_run_status
      ELSE 'completed'::auto_run_status
    END,
    completed_at = CASE
      WHEN (SELECT COUNT(*) FROM auto_step_runs WHERE run_id = p_run_id AND status IN ('pending','running')) = 0
      THEN now() ELSE NULL
    END
  WHERE id = p_run_id;
END; $$;
```

---

## ✅ Critérios de Aceitação

- [x] Edge Function worker processa steps pendentes da fila (via Next.js API route — ver IMPL-AUTO-F6-DESVIOS.md)
- [x] WhatsApp node envia texto, imagem, documento via Uazapi
- [x] Email node envia via Resend e regista em log_emails
- [x] Condition node avalia regras e segue handle correcto
- [x] Supabase Query executa SELECT, INSERT, UPDATE, RPC
- [x] Task Lookup busca/cria lead e segue handle found/created
- [x] Delay node agenda step para o futuro
- [x] Webhook receiver aceita POST e dispara fluxo
- [x] Modo sincrono: webhook com Webhook Response retorna dados ao caller
- [x] Modo assincrono: webhook enfileira e retorna run_id
- [x] Retry com backoff exponencial funciona para steps falhados
- [x] Run status actualiza automaticamente (running -> completed/failed)
- [x] Delivery log regista cada mensagem/email enviado

## 📝 Notas para o Claude Code

1. **Deploy Edge Function** via `SupabaseInfinity:deploy_edge_function`
2. **A Edge Function precisa** de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UAZAPI_URL`, `RESEND_API_KEY` como secrets
3. **Os processadores de node** são funções puras — recebem (supabase, nodeData, context) e retornam resultado
4. **Rate limiting WhatsApp:** mínimo 1500ms entre envios
5. **O SyncFlowExecutor** tem timeout de 25s — se exceder, retorna 504
6. **Testar cada processador individualmente** antes de integrar no worker
