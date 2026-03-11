# CONFIGURAÇÃO DO CRON WORKER — Concluída

## O que foi configurado no Supabase

### 3 Cron Jobs activos:

| Job | Schedule | O que faz |
|-----|----------|-----------|
| `auto-detect-stuck` | Cada 5 min | Reseta steps travados em `running` há mais de 5 min |
| `auto-cleanup` | 3h diário | Limpa runs antigos (+90 dias) |
| `auto-process-worker` ✨ | **Cada 1 min** | **Chama `POST app.infinitygroup.pt/api/automacao/worker`** |

### Secrets no Vault:

| Nome | Valor | Uso |
|------|-------|-----|
| `auto_worker_url` | `https://app.infinitygroup.pt` | URL base da app |
| `auto_cron_secret` | `7add2e3e-986c-41f0-b4a5-2133591ee65f` | Token de autenticação do cron |

### Como funciona:

```
A cada minuto:
  pg_cron → pg_net HTTP POST → https://app.infinitygroup.pt/api/automacao/worker
    Headers: Authorization: Bearer 7add2e3e-986c-41f0-b4a5-2133591ee65f
    Body: { source: "pg_cron", timestamp: "..." }
    Timeout: 25s
    
  Worker → auto_claim_steps(5) → processa até 5 steps pendentes → enfileira próximos
```

---

## O que falta configurar na APP (Hetzner)

### 1. Adicionar ao `.env.local` (ou `.env.production`):

```env
CRON_SECRET=7add2e3e-986c-41f0-b4a5-2133591ee65f
```

### 2. Verificar que o worker route aceita este token

O ficheiro `app/api/automacao/worker/route.ts` deve verificar o header `Authorization`:

```typescript
// No início da route:
const authHeader = request.headers.get("authorization")
const expectedSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

**Se o worker já faz esta verificação** (conforme documentado nos desvios da F6), basta adicionar o `CRON_SECRET` ao `.env` e está feito.

**Se NÃO faz**, adicionar a verificação como primeira coisa na route.

---

## Como testar

### 1. Verificar que o cron está a chamar:

```sql
-- Ver últimas execuções do cron
SELECT * FROM cron.job_run_details
WHERE jobid = 3
ORDER BY start_time DESC
LIMIT 5;
```

### 2. Verificar respostas do pg_net:

```sql
-- Ver respostas HTTP do worker
SELECT id, status_code, content, timed_out, error_msg, created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

### 3. Verificar que steps pendentes são processados:

```sql
-- Ver steps que passaram de pending → completed nas últimas horas
SELECT id, node_type, status, started_at, completed_at
FROM auto_step_runs
WHERE status IN ('completed', 'failed')
ORDER BY completed_at DESC
LIMIT 10;
```

---

## Se mudar o domínio no futuro

```sql
-- Actualizar o URL no Vault
UPDATE vault.secrets
SET secret = 'https://novo-dominio.pt'
WHERE name = 'auto_worker_url';
```

## Se quiser parar o cron temporariamente

```sql
-- Desactivar
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'auto-process-worker'),
  active := false
);

-- Reactivar
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'auto-process-worker'),
  active := true
);
```
