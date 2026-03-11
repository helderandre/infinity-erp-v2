# SPEC-AUTO-F7-MONITORIZACAO — Fase 7: Monitorização, Histórico e Gestão de Execuções

**Data:** 2026-03-05
**Prioridade:** 🟡 Média
**Estimativa:** 2 sessões de Claude Code
**Pré-requisitos:** F6 concluída (motor de execução a funcionar)

---

## 📋 Objectivo

Criar a interface de monitorização em tempo real das execuções de fluxos, histórico detalhado nó-a-nó, capacidade de reenviar execuções falhadas, dashboard de métricas, e acompanhamento ao vivo via Supabase Realtime. Permitir que o utilizador veja exactamente o que aconteceu em cada passo, com dados de entrada/saída e mensagens enviadas.

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| **API Routes** | |
| `app/api/automacao/execucoes/route.ts` | GET global de execuções (cross-flow) |
| `app/api/automacao/fluxos/[flowId]/executions/route.ts` | GET execuções de um fluxo |
| `app/api/automacao/fluxos/[flowId]/executions/[runId]/route.ts` | GET detalhe + POST retry |
| `app/api/automacao/stats/route.ts` | GET métricas do dashboard |
| **Páginas** | |
| `app/(dashboard)/automacao/page.tsx` | Dashboard de automações |
| `app/(dashboard)/automacao/execucoes/page.tsx` | Histórico global |
| **Componentes** | |
| `components/automations/execution-timeline.tsx` | Timeline de steps (com Realtime) |
| `components/automations/execution-detail-sheet.tsx` | Sheet com detalhe completo |
| `components/automations/execution-card.tsx` | Card na listagem de execuções |
| `components/automations/automation-tester.tsx` | Dialog de teste com monitorização |
| `components/automations/stats-cards.tsx` | Cards de métricas |
| **Hooks** | |
| `hooks/use-realtime-execution.ts` | Monitoramento via Supabase Realtime |
| `hooks/use-executions.ts` | Histórico + detalhes + retry |

---

## 📊 Dashboard: `app/(dashboard)/automacao/page.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  Automações                                                  │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Fluxos   │ │Execuções │ │ Taxa     │ │ Entregas │        │
│  │    8     │ │   247    │ │ Sucesso  │ │   892    │        │
│  │ 5 activos│ │ últimos  │ │  96.4%   │ │ 634 WPP  │        │
│  │ 3 inact. │ │ 14 dias  │ │ 3 falhas │ │ 258 Email│        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐  ┌────────────────────────┐ │
│  │ Execuções últimos 14 dias   │  │ Saúde das Integrações  │ │
│  │ [gráfico barras por dia]    │  │ 🟢 WhatsApp: 2 online │ │
│  │ ■ Concluídas  ■ Falhadas    │  │ 🟢 Email: Activo      │ │
│  │                              │  │ Taxa entrega: 98.2%   │ │
│  └─────────────────────────────┘  └────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Últimas Execuções                               [Ver todas] │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✅ Boas-vindas Lead    João Silva    há 5 min  3/3    │  │
│  │ ✅ Follow-up 3 dias    Maria Santos  há 12 min 2/2    │  │
│  │ ❌ Proposta Enviada    Pedro Costa   há 1h     2/3    │  │
│  │ ⏳ Contrato Assinado   Ana Ferreira  a decorrer 1/4   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📜 Histórico: `app/(dashboard)/automacao/execucoes/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Execuções          [Estado ▼]  [Fluxo ▼]    [🔄 Actualizar]│
│                     247 execuções                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✅ João Silva                     Concluído            │  │
│  │    🔗 Boas-vindas Lead                                 │  │
│  │    📊 3/3 passos · há 5 minutos                       │  │
│  │    ▼ (expandir para ver steps)                         │  │
│  │    ┌──────────────────────────────────────────────┐    │  │
│  │    │ ✅ Passo 1: Buscar Lead        0.2s          │    │  │
│  │    │ ✅ Passo 2: Condição           0.1s          │    │  │
│  │    │ ✅ Passo 3: WhatsApp           2.4s          │    │  │
│  │    │    └ 💬 "Olá João! Bem-vindo..."             │    │  │
│  │    │    └ 🖼️ boas-vindas.jpg                      │    │  │
│  │    └──────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ❌ Pedro Costa                     Falhou              │  │
│  │    🔗 Proposta Enviada                                 │  │
│  │    📊 2/3 passos · 1 falha · há 1 hora               │  │
│  │    [🔄 Reenviar]                                      │  │
│  │    ▼ (expandir)                                        │  │
│  │    ┌──────────────────────────────────────────────┐    │  │
│  │    │ ✅ Passo 1: Supabase Query     0.3s          │    │  │
│  │    │ ✅ Passo 2: Email              1.1s          │    │  │
│  │    │ ❌ Passo 3: WhatsApp           —             │    │  │
│  │    │    └ Erro: Instância desconectada            │    │  │
│  │    │    └ [🔄 Reenviar este passo]                │    │  │
│  │    └──────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [← Anterior]  Página 1 de 9  [Próxima →]                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🕐 Timeline em Tempo Real: `execution-timeline.tsx`

Componente que mostra o progresso de uma execução ao vivo. Usa Supabase Realtime.

```
┌──────────────────────────────────────────────┐
│ Execução a decorrer...           2/5 passos  │
│ ████████░░░░░░░░░░░░  40%                   │
│                                              │
│ ✅ 14:32:01  Buscar Lead                     │
│              João Silva encontrado (0.2s)    │
│                                              │
│ ✅ 14:32:01  Condição: temperatura           │
│              "Quente" → Sim (0.1s)           │
│                                              │
│ ⏳ 14:32:02  WhatsApp                        │
│              A enviar mensagens...           │
│              ░░░░░░░░ (a processar)          │
│                                              │
│ ⏸️ 14:32:--  Aguardar 3 dias                 │
│              Agendado para 08/03/2026        │
│                                              │
│ ⏸️ 14:32:--  Email                           │
│              Pendente                        │
└──────────────────────────────────────────────┘
```

### Hook `use-realtime-execution.ts`

```typescript
export function useRealtimeExecution() {
  return {
    runId: string | null,
    steps: RealtimeStep[],
    totalSteps: number,
    completedSteps: number,
    failedSteps: number,
    isRunning: boolean,
    isFinished: boolean,
    overallStatus: "idle" | "running" | "completed" | "failed",
    startMonitoring: (runId: string) => Promise<void>,
    stopMonitoring: () => void,
  }
}
```

**Mecanismo:**
1. `startMonitoring(runId)` → busca steps existentes + inicia subscription Realtime
2. `supabase.channel("auto-run-{runId}")` escuta INSERT e UPDATE em `auto_step_runs` filtrado por `run_id`
3. Cada evento actualiza o `stepsMap` e recalcula totais
4. `isFinished` = total > 0 && nenhum pending/running
5. Cleanup ao desmontar ou chamar `stopMonitoring()`

---

## 🧪 Tester: `automation-tester.tsx`

Dialog/Sheet para testar um fluxo directamente do editor. Integra o hook de Realtime.

```
┌──────────────────────────────────────────────────┐
│  Testar Fluxo: "Boas-vindas Lead"                │
├──────────────────────────────────────────────────┤
│                                                  │
│  Seleccionar Lead:                               │
│  [🔍 Pesquisar lead...]                          │
│  João Silva (joao@email.com)              [✓]    │
│  Maria Santos (maria@email.com)                  │
│                                                  │
│  Ou preencher variáveis manualmente:             │
│  ┌────────────────────────────────────────────┐  │
│  │ lead_nome:    [João Silva]                 │  │
│  │ lead_email:   [joao@email.com]             │  │
│  │ lead_telefone:[+351 912 345 678]           │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [▶ Iniciar Teste]                               │
│                                                  │
│  ── Resultado ─────────────────────────────────  │
│                                                  │
│  [Timeline em tempo real aparece aqui]           │
│                                                  │
│  ✅ Teste concluído com sucesso!                 │
│  💬 2 mensagens WhatsApp enviadas                │
│  📧 1 email enviado                              │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🔌 API Routes

### `GET /api/automacao/execucoes`

Listagem global cross-flow com agrupamento e paginação.

```typescript
// Query: ?status=failed&limit=30&offset=0&flow_id=uuid
// Response: { executions: RunGroup[], total: number }

// Cada RunGroup:
{
  id: string,           // run_id
  flow_id: string,
  flow_name: string,
  entity_type: string,
  entity_id: string,
  entity_name: string,  // Nome do lead/proprietário (JOIN)
  status: "completed" | "failed" | "running" | "pending",
  triggered_by: string,
  total_steps: number,
  completed_steps: number,
  failed_steps: number,
  started_at: string,
  completed_at: string,
  steps: StepSummary[],  // Resumo de cada step
}
```

### `GET /api/automacao/fluxos/[flowId]/executions/[runId]`

Detalhe completo de uma execução.

```typescript
// Response:
{
  run: AutoRun,
  steps: AutoStepRun[],       // Ordenados por created_at
  deliveries: AutoDeliveryLog[],  // Mensagens/emails enviados
  flow_name: string,
  entity: { type, id, name, email },
}
```

### `POST /api/automacao/fluxos/[flowId]/executions/[runId]`

Reenviar execução (retry steps falhados).

```typescript
// Body: { instance_id?: string }  (opcionalmente mudar instância WhatsApp)
// Lógica:
//   1. Buscar steps com status = 'failed' para este run_id
//   2. Reset: status → 'pending', scheduled_for → now(), error_message → null, retry_count += 1
//   3. Se instance_id: actualizar auto_flows.wpp_instance_id
// Response: { retried_count: number, retried_step_ids: string[] }
```

### `GET /api/automacao/stats`

Métricas para o dashboard.

```typescript
// Response:
{
  overview: {
    totalFlows: number,
    activeFlows: number,
    totalRuns: number,        // últimos 14 dias
    completedRuns: number,
    failedRuns: number,
    successRate: number,      // percentagem
    totalDeliveries: number,
    whatsappDeliveries: number,
    emailDeliveries: number,
  },
  executionsByDay: [
    { day: "2026-03-01", total: 12, completed: 11, failed: 1 },
    // últimos 14 dias
  ],
  integrationHealth: {
    whatsapp: { total: 3, connected: 2, status: "healthy" | "degraded" | "offline" },
    email: { status: "healthy" | "offline" },
    deliveryRate: number,     // percentagem de entregas bem-sucedidas
  },
}
```

---

## 🔄 Funcionalidades de Gestão de Execuções

### A partir do Editor (Fluxo específico)

| Acção | Onde | O que faz |
|-------|------|-----------|
| **Testar** | Botão no editor | Abre tester dialog, executa, monitoriza ao vivo |
| **Ver execuções** | Tab/painel no editor | Lista execuções deste fluxo |
| **Parar execução** | Botão na timeline | UPDATE steps pendentes → 'cancelled' |

### A partir do Histórico (Global)

| Acção | Onde | O que faz |
|-------|------|-----------|
| **Filtrar** | Toolbar | Por estado, fluxo, período |
| **Expandir** | Click no card | Mostra steps individuais com input/output |
| **Reenviar** | Botão na execução falhada | Reset steps falhados → pendente |
| **Ver detalhes** | Sheet lateral | Dados completos: context, deliveries, erros |

### A partir de Outras Partes do Sistema

Outros módulos do ERP podem disparar fluxos via API:

```typescript
// Exemplo: Ao criar lead, disparar fluxo de boas-vindas
const res = await fetch(`/api/automacao/fluxos/${flowId}/test`, {
  method: "POST",
  body: JSON.stringify({
    entity_type: "lead",
    entity_id: lead.id,
    test_variables: { lead_nome: lead.nome, lead_email: lead.email }
  })
})
const { run_id } = await res.json()
// Opcionalmente monitorizar com useRealtimeExecution
```

---

## 🔔 Webhook Test Listener

Componente inline no trigger webhook node para testar recepção.

### Hook: `use-webhook-test-listener.ts`

```typescript
export function useWebhookTestListener() {
  return {
    status: "idle" | "listening" | "received" | "timeout" | "error",
    payload: Record<string, unknown> | null,
    countdown: number,          // Segundos restantes (120s)
    startListening: (webhookKey: string) => void,
    stopListening: () => void,
    reset: () => void,
  }
}
```

**Mecanismo:**
1. `startListening(key)` → subscription Realtime em `auto_webhook_captures` filtrada por `source_id=key`
2. Countdown de 120 segundos com indicador visual pulsante
3. Quando payload chega → mostra JSON tree + field mapper
4. Timeout → mensagem + botão "Tentar novamente"
5. Cleanup ao desmontar

---

## ✅ Critérios de Aceitação

- [x] Dashboard mostra métricas correctas (fluxos, execuções, taxa sucesso, entregas)
- [x] Gráfico de execuções por dia renderiza últimos 14 dias (echarts com barras empilhadas)
- [x] Listagem de execuções com filtro por estado e fluxo
- [x] Expandir execução mostra timeline de steps com status e duração
- [x] Detalhe de step mostra input_data e output_data formatados
- [x] Steps falhados mostram mensagem de erro e botão reenviar
- [x] Reenviar reseta steps falhados e worker re-processa
- [x] Timeline em tempo real actualiza via Supabase Realtime
- [x] Tester dialog permite preencher variáveis e executar teste (sem autocomplete de lead — ver IMPL-AUTO-F7-DESVIOS.md)
- [x] Tester mostra progresso ao vivo até conclusão
- [x] Webhook listener funciona com countdown de 120s (já existia da F5)
- [ ] Parar execução cancela steps pendentes (não implementado — ver nota abaixo)
- [x] API `/api/automacao/fluxos/[id]/test` é acessível de outros módulos

**Nota:** "Parar execução" (cancelar steps pendentes) não foi implementado nesta iteração. Requer um endpoint dedicado e lógica para cancelar steps na fila pgmq. Pode ser adicionado numa iteração futura quando o worker estiver em produção com volume real.

## 📝 Notas para o Claude Code

1. **Reutilizar padrões do LeveMãe:** `use-realtime-execution.ts`, `automation-tester.tsx`, `executions-table.tsx`
2. **Gráfico:** Usa echarts com `echarts-for-react` (tree-shaking via imports granulares)
3. **Collapsible para execuções:** Usar `Collapsible` do shadcn/ui (já no LeveMãe)
4. **Realtime subscription:** Canal por `run_id`, escutar INSERT+UPDATE em `auto_step_runs`
5. **Paginação:** Server-side com offset/limit, não carregar tudo
6. **JSON viewer para input/output:** Componente simples com `<pre>` formatado ou reutilizar `webhook-json-tree.tsx`
7. **A timeline é o componente mais importante** — investir na UX com ícones, cores e tempos
