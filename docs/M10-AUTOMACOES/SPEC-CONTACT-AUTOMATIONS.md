# Contact Automations — Envios agendados por contacto

> **Evoluído por `add-fixed-contact-automations`** (2026-04-16): os três eventos fixos (`aniversario_contacto`, `natal`, `ano_novo`) deixaram de ser criados pelo wizard e passaram a uma pista virtual implícita, com cascata de templates (lead → consultor → global), mutes combinatórios, hub CRM central e overrides por-lead. Ver [SPEC-FIXED-CONTACT-AUTOMATIONS.md](./SPEC-FIXED-CONTACT-AUTOMATIONS.md). Este documento cobre a pista manual legada (`aniversario_fecho` + `festividade`).

Entregue em `add-contact-automations` (OpenSpec). Adiciona a tab **Automatismos** na página do lead (`/dashboard/leads/[id]`, tabela `leads`) permitindo ao consultor agendar envios automáticos de email e/ou WhatsApp em datas-chave: aniversário do contacto, aniversário de fecho de negócio, Natal, Ano Novo ou festividade personalizada. A FK `contact_automations.contact_id` aponta para `leads(id)`.

Resolve também a lacuna crítica do runtime de automações: triggers agendados em `auto_triggers` existiam mas nenhum worker criava runs quando a hora batia. Este change entrega o primeiro spawner funcional, focado em `contact_automations`.

---

## Arquitectura

```
┌─────────────────────┐   Vercel Cron (* * * * *)
│  Wizard 6 passos    │   ┌───────────────────────────────────┐
│  (tab Automatismos) │   │ /api/automacao/scheduler/         │
└──────────┬──────────┘   │ spawn-runs                        │
           │ POST          │   ─ reconcile runs pendentes     │
           ▼               │   ─ SELECT automações elegíveis  │
┌──────────────────────┐   │   ─ resolveContactVariables()    │
│ contact_automations  │──▶│   ─ skip parcial/total           │
│ (trigger_at,         │   │   ─ INSERT auto_runs (sentinela) │
│  template_overrides) │   │   ─ INSERT auto_step_runs        │
└──────────────────────┘   │     (node_data_snapshot)         │
                           │   ─ advance after run            │
                           └──────────┬───────────────────────┘
                                      │
                                      ▼
                   ┌───────────────────────────────────┐
                   │ /api/automacao/worker             │
                   │   ─ RPC auto_claim_steps          │
                   │   ─ se node_data_snapshot:        │
                   │       node inline (sem flow)      │
                   │   ─ chama processor (email/wpp)   │
                   │   ─ escreve auto_delivery_log     │
                   └──────────┬────────────────────────┘
                              │
                              ▼
                   ┌───────────────────────────────────┐
                   │ Email: smtp-send edge (consultant)│
                   │ WhatsApp: UAZAPI (instância)      │
                   └───────────────────────────────────┘
```

## Tabelas

| Tabela | Função |
|---|---|
| `contact_automations` | Fonte de agendamento por-contacto (trigger_at, recurrence, canais, templates, overrides) |
| `contact_automation_runs` | Histórico de execuções, único por `(automation_id, scheduled_for)` |
| `auto_scheduler_log` | Telemetria de cada tick (evaluated, spawned, skipped, errors) |
| `auto_flows` | +1 row sentinela `00000000-0000-0000-0000-00000c0a0a17` para satisfazer FK `flow_id NOT NULL` |
| `auto_step_runs.node_data_snapshot` | Nova coluna JSONB para runs efémeros (sem published_definition) |

## APIs

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/leads/[id]/automations` | Cria (valida Zod, calcula `trigger_at`) |
| GET | `/api/leads/[id]/automations` | Lista com `last_run` agregado |
| GET | `/api/leads/[id]/automations/[automationId]` | Detalhe + runs |
| PATCH | `/api/leads/[id]/automations/[automationId]` | Edição enquanto `status='scheduled'` |
| DELETE | `/api/leads/[id]/automations/[automationId]` | Soft cancel |
| DELETE | `/api/leads/[id]/automations` | Bulk cancel |
| GET | `/api/leads/[id]/automations/[automationId]/runs` | Histórico completo |
| POST | `/api/automacao/scheduler/spawn-runs` | Cron — requer `Authorization: Bearer $CRON_SECRET` |

Todas as rotas CRUD exigem `requirePermission('leads')`.

## Variáveis disponíveis nos templates

Resolvidas em [lib/automacao/resolve-contact-variables.ts](../../lib/automacao/resolve-contact-variables.ts) no momento do spawn (dados frescos):

- `{{contact_name}}`, `{{contact_first_name}}`, `{{contact_email}}`, `{{contact_phone}}`, `{{contact_birthday}}`
- `{{deal_name}}` (derivado `tipo + localizacao`), `{{deal_closing_date}}`, `{{deal_years_since_close}}`, `{{deal_value}}` (€)
- `{{today_date}}`, `{{current_year}}`

## Categorias de templates

Canónicas (em [lib/constants-template-categories.ts](../../lib/constants-template-categories.ts)):

`aniversario_contacto | aniversario_fecho | natal | ano_novo | festividade | custom | geral`

- Email: validação Zod + dropdown no editor ([email-topbar.tsx](../../components/email-editor/email-topbar.tsx)) + filtro na listagem.
- WhatsApp: enum `WhatsAppTemplateCategory` estendido com os mesmos valores (mantendo retrocompatibilidade com `boas_vindas`, `follow_up`, etc).

## Agendamento do Spawner

### Produção — Coolify Scheduled Tasks (ambiente actual)

O projecto está deployado em Coolify + Hetzner, **não** em Vercel. A forma canónica de invocar o spawner é via **Scheduled Tasks** da aplicação no Coolify:

1. Abrir a aplicação no Coolify → **Scheduled Tasks** → **Add New Task**
2. **Name**: `contact-automations-spawner`
3. **Command**:
   ```bash
   curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/automacao/scheduler/spawn-runs
   ```
   (usar `http://localhost:3000` porque a task corre dentro do mesmo container da app)
4. **Frequency**: `* * * * *` (a cada minuto)
5. **Container**: seleccionar o container da app Next.js
6. Garantir que `CRON_SECRET` está definido nas variáveis de ambiente da aplicação em Coolify

Como diagnosticar:
- Logs da Scheduled Task visíveis no painel de Coolify
- `SELECT * FROM auto_scheduler_log ORDER BY tick_at DESC LIMIT 20;` mostra os ticks que chegaram ao endpoint
- Se `curl` devolve 401 → `CRON_SECRET` não está a ser lido pela aplicação (verificar variáveis)

### Disparar manualmente (catch-up ou debug)

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<seu-dominio>/api/automacao/scheduler/spawn-runs
```

Devolve `{ evaluated, spawned, skipped, errors, duration_ms }`.

### Vercel (não usado neste projecto)

O ficheiro `vercel.json` existente tem uma entrada `crons` equivalente — fica preparada caso surja um deploy paralelo em Vercel, mas não é o mecanismo activo.

## Variáveis de ambiente

| Var | Descrição |
|---|---|
| `CRON_SECRET` | Bearer para spawner e worker |
| `AUTOMACAO_SPAWNER_ENABLED` | `"false"` desactiva o tick sem alterar schema |
| `ENCRYPTION_KEY` | Desencripta password SMTP em `consultant_email_accounts` |
| `EDGE_SMTP_SECRET` | Header `x-edge-secret` para Edge Function `smtp-send` |

## Envio via SMTP do consultor

Cada automatismo de email guarda `smtp_account_id → consultant_email_accounts.id`. O processor [lib/node-processors/email.ts](../../lib/node-processors/email.ts) detecta a presença e usa [lib/email/resolve-account-admin.ts](../../lib/email/resolve-account-admin.ts) (variante service-role do `resolveEmailAccount` original) para obter credenciais, depois envia via Edge Function `smtp-send` em vez do fluxo legacy `send-email` / Resend.

## Idempotência e concorrência

- Chave única `(contact_automation_id, scheduled_for)` em `contact_automation_runs` garante uma execução por ocorrência.
- Janela de 5min em `trigger_at <= now() + interval '5 minutes'` tolera clock drift.
- Batch 50 por tick; rate limit do worker existente (20 runs / 5min / flow) também aplica ao flow sentinela.

## Reagendamento

- `recurrence='yearly'`: após spawn, `trigger_at += 1 year` via `addOneYear()` (TZDate-aware, fallback para 28-02 em ano bissexto).
- `recurrence='once'`: após spawn, `status='completed'`.
- Reconciliação `contact_automation_runs.pending → sent/failed` ocorre no tick seguinte via inspecção do `auto_run.status` + `auto_delivery_log`.

## Desvios da proposta inicial

- **Flow sentinela em vez de `flow_id=null`**: menos invasivo, não altera NOT NULL de `auto_runs`/`auto_step_runs`. ID reservado `00000000-0000-0000-0000-00000c0a0a17`.
- **Tabela-alvo corrigida mid-implementation**: arrancámos contra `leads_contacts` mas a UI vive em `/dashboard/leads/[id]` (tabela `leads`). Migration `contact_automations_repoint_to_leads` trocou a FK; resolver lê `leads.nome / telemovel / data_nascimento` com fallbacks para `full_name / phone_primary / date_of_birth`.
- **`deal_name` derivado**: `negocios` não tem coluna nominal — helper usa `${tipo} — ${localizacao}`.
- **Wizard sem `react-hook-form`**: 6 passos lineares com estado plano bastam; evita overhead.
- **Unit tests adiados**: projecto sem runner de testes configurado; cobertura via E2E manual.
