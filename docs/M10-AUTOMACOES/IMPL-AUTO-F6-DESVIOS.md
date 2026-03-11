# IMPL-AUTO-F6-DESVIOS — Desvios da Implementacao da Fase 6

**Data:** 2026-03-06
**Status:** Implementado com desvios documentados abaixo

---

## 1. Worker como Next.js API Route (nao Edge Function)

**Spec original:** Edge Function Supabase (`supabase/functions/auto-worker/index.ts`) invocada por pg_cron.

**Implementado:** Next.js API Route (`app/api/automacao/worker/route.ts`) que pode ser invocado por:
- Vercel Cron Jobs (`vercel.json` com schedule)
- pg_cron via pg_net (HTTP POST ao endpoint)
- Chamada manual para debug

**Razao:** O projecto usa Next.js na Vercel, nao tem Deno runtime configurado. Manter tudo no mesmo deploy simplifica a operacao. A logica e identica: reclama batch via `auto_claim_steps()`, processa, enfileira proximos.

**Impacto:** Nenhum impacto funcional. O worker faz exactamente o mesmo ciclo: claim -> process -> enqueue next -> update counts.

**Como configurar o cron:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/automacao/worker",
    "schedule": "* * * * *"
  }]
}
```

Ou via pg_cron + pg_net:
```sql
SELECT cron.schedule('auto-worker', '* * * * *',
  $$ SELECT net.http_post(
    'https://your-domain.com/api/automacao/worker',
    '{}',
    '{"Authorization": "Bearer YOUR_SECRET"}'
  ) $$
);
```

---

## 2. Processadores de Node em `lib/node-processors/` (nao duplicados na Edge Function)

**Spec original:** Os processadores seriam usados tanto no SyncFlowExecutor (Next.js) como no worker (Edge Function Deno), o que implicaria duplicacao ou modulos partilhados.

**Implementado:** Uma unica pasta `lib/node-processors/` com 10 processadores que sao importados tanto pelo worker route como pelo SyncFlowExecutor. Zero duplicacao.

---

## 3. Autenticacao do Worker Endpoint

**Spec original:** Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` automaticamente via Deno env.

**Implementado:** O endpoint `/api/automacao/worker` verifica `Authorization: Bearer <CRON_SECRET>` no header. Se `CRON_SECRET` nao estiver definido, usa `SUPABASE_SERVICE_ROLE_KEY` como fallback. Isto protege o endpoint de invocacoes nao autorizadas.

---

## 4. Test Route com Execucao Real

**Spec original:** A route de teste (`/api/automacao/fluxos/[flowId]/test`) apenas criava records no banco.

**Implementado:** A route de teste agora executa o fluxo de forma sincrona via `SyncFlowExecutor`, registando cada step executado e enfileirando nodes assincronos. Retorna `steps_executed` e `async_nodes_queued` na resposta.

---

## 5. API de Execucoes Adicionada

**Spec F6 nao especificava detalhes**, mas e necessaria para a Fase 7 (Monitorizacao).

**Implementado:**
- `GET /api/automacao/execucoes` — Lista execucoes com filtros (flow_id, status) e paginacao
- `GET /api/automacao/execucoes/[executionId]` — Detalhe com steps e delivery log
- `POST /api/automacao/execucoes/[executionId]` — Retry de steps falhados

---

## 6. Coluna `is_test` nao existe em `auto_runs`

**Spec original:** O teste inseria `is_test: true` no run.

**Implementado:** Removido `is_test` do insert pois a coluna nao existe no schema actual. Testes sao identificados por `triggered_by: 'manual'`.

---

## Ficheiros Criados

| Ficheiro | Descricao |
|----------|-----------|
| `lib/node-processors/index.ts` | Registry de processadores + interface comum |
| `lib/node-processors/condition.ts` | Avalia condicoes (AND/OR) |
| `lib/node-processors/set-variable.ts` | Define variaveis no contexto |
| `lib/node-processors/delay.ts` | Calcula scheduled_for futuro |
| `lib/node-processors/supabase-query.ts` | SELECT/INSERT/UPDATE/UPSERT/DELETE/RPC |
| `lib/node-processors/task-lookup.ts` | Busca/cria lead/owner/user |
| `lib/node-processors/whatsapp.ts` | Envia via Uazapi (texto + media) |
| `lib/node-processors/email.ts` | Envia via Resend + log_emails |
| `lib/node-processors/http-request.ts` | Chamada HTTP externa |
| `lib/node-processors/webhook-response.ts` | Gera resposta para o caller |
| `lib/node-processors/notification.ts` | Cria notificacao no sistema |
| `lib/sync-flow-executor.ts` | Engine de execucao sincrona |
| `app/api/automacao/worker/route.ts` | Worker que processa fila |
| `app/api/automacao/execucoes/route.ts` | Lista de execucoes |
| `app/api/automacao/execucoes/[executionId]/route.ts` | Detalhe + retry |

## Ficheiros Modificados

| Ficheiro | Alteracao |
|----------|-----------|
| `app/api/webhook/[key]/route.ts` | Adicionado modo sincrono + assincrono completo |
| `app/api/automacao/fluxos/[flowId]/test/route.ts` | Execucao real via SyncFlowExecutor |

## SQL Executado

| Funcao | Descricao |
|--------|-----------|
| `auto_update_run_counts(p_run_id UUID)` | Actualiza contadores e status do run |
