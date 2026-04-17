# Fixed Contact Automations (aniversário, Natal, Ano Novo)

Este documento descreve a arquitectura final dos 3 eventos fixos implementados pela change `add-fixed-contact-automations`. Complementa — e não substitui — [SPEC-CONTACT-AUTOMATIONS.md](./SPEC-CONTACT-AUTOMATIONS.md), que cobre o módulo de automatismos manuais (wizard + `contact_automations`).

## Arquitectura de alto nível

Dois caminhos coexistem no mesmo spawner (`app/api/automacao/scheduler/spawn-runs/route.ts`):

1. **Fase A — Manual** (legado). Lê `contact_automations` com `status='scheduled'` e `trigger_at` dentro de 5 min. Inalterada.
2. **Fase B — Virtual** (nova). A partir de `leads × {aniversario_contacto, natal, ano_novo}`:
   - Elegibilidade: `agent_id IS NOT NULL AND (email OR telemovel)`; aniversário só para leads com `data_nascimento`.
   - Reconciliação com a fase A: se existir `contact_automations` row para o mesmo `(lead, event_type)` com status `scheduled|completed`, a virtual salta.
   - Cascata de template + selecção de conta + mute são aplicados por canal independentemente.
   - Unique `(kind='virtual', lead_id, event_type, scheduled_for)` em `contact_automation_runs` garante idempotência do tick.

## Cascata de templates (D2)

Para cada `(lead, event_type, channel)` em que `channel ∈ {email, whatsapp}`:

1. **Lead** — `contact_automation_lead_settings.email_template_id/wpp_template_id` se activo e acessível.
2. **Consultor** — `tpl_email_library/auto_wpp_templates` com `scope='consultant' AND scope_id = leads.agent_id AND category = event_type AND is_active=true`.
3. **Global** — mesmo select com `scope='global'`, preferindo `is_system=true`.

Se nenhum layer devolve um template, o canal é saltado e registado em `auto_scheduler_log.skipped_breakdown.missing_template`.

Templates marcados `is_system=true` não podem ser eliminados (trigger DB `block_delete_system_template`).

## Selecção de conta (D5)

- **Override por-lead**: `contact_automation_lead_settings.smtp_account_id` ou `wpp_instance_id`. Validado (ownership + status); se inválido cai no fallback.
- **Fallback**: primeiro `consultant_email_accounts` com `is_active=true` ordenado por `created_at ASC`; primeiro `auto_wpp_instances` com `connection_status='connected'` ordenado por `created_at ASC`.
- **Nenhuma conta disponível**: canal saltado silenciosamente e contabilizado em `skipped_breakdown.no_channel`.

## Mutes combinatórios (D4)

Tabela única `contact_automation_mutes` com 4 colunas nullable `(consultant_id, lead_id, event_type, channel)`. Null = "todos".

Predicado (null-as-wildcard):
```
(mute.consultant_id IS NULL OR mute.consultant_id = leads.agent_id)
AND (mute.lead_id IS NULL OR mute.lead_id = L)
AND (mute.event_type IS NULL OR mute.event_type = E)
AND (mute.channel IS NULL OR mute.channel = C)
```

Implementação: [`lib/automacao/is-muted.ts`](../../lib/automacao/is-muted.ts).

## Reagendamento virtual (D7)

Calculado por aritmética de data via [`lib/automacao/next-fixed-occurrence.ts`](../../lib/automacao/next-fixed-occurrence.ts):

- `aniversario_contacto`: mês/dia de `leads.data_nascimento`, ano actual ou +1; fallback 28/02 para 29/02 em anos não-bissextos.
- `natal`: 25/12 às `send_hour` (default 08:00 Europe/Lisbon).
- `ano_novo`: 31/12 às `send_hour`.

Cada ocorrência gera um `contact_automation_runs (kind='virtual')` com unique key `(lead_id, event_type, scheduled_for)`.

## APIs públicas

### Overrides por-lead
- `GET /api/leads/[id]/automation-settings` — listar overrides.
- `POST /api/leads/[id]/automation-settings` — upsert `(lead_id, event_type)`.
  - Body: `{event_type, email_template_id?, wpp_template_id?, smtp_account_id?, wpp_instance_id?, send_hour?}`.
  - Códigos de erro: `template_not_accessible | account_not_owned | instance_not_owned`.
- `DELETE /api/leads/[id]/automation-settings?event_type=X` — remover override.

### Mutes
- `GET /api/contact-automation-mutes` — listar (scope do utilizador).
- `POST /api/contact-automation-mutes` — criar. Row idêntica devolve 200 com `duplicate:true`.
- `DELETE /api/contact-automation-mutes?id=X` — remover (broker sempre, consultor só se `muted_by=user.id`).

### Retry / Reschedule
- `POST /api/automacao/runs/[id]/retry` — re-resolve cascata fresca; cria novo run com `parent_run_id`.
- `POST /api/automacao/runs/[id]/reschedule` — body `{trigger_at: ISO8601}`; 400 `trigger_in_past` se <now().
- `POST /api/automacao/runs/retry-batch` / `reschedule-batch` — `{ids: uuid[]}` max 100.

### Hub CRM
- `GET /api/crm/contact-automations-scheduled` — combina pista manual + virtual com filtros e cursor.
- `GET /api/crm/contact-automations-failed` — últimos 30 dias `status='failed'` (scope).

### Templates com scope
- `GET /api/automacao/email-templates?scope=global|consultant` — visibilidade por utilizador.
- `POST /api/automacao/email-templates` com `scope='consultant'` → `scope_id=user.id` forçado.
- Idem para `/api/automacao/templates-wpp`.

## Páginas de UI

- `/dashboard/crm/automatismos-contactos` — hub CRM com 4 tabs (Agendados | Runs falhados | Os meus templates | Mutes globais).
- `/dashboard/leads/[id]` → tab "Automatismos" — secção "Eventos fixos" no topo com 3 linhas virtuais + botões Personalizar/Mutar.

## Observabilidade

`auto_scheduler_log` ganha `phase text` e `skipped_breakdown jsonb`. Um row por fase por tick.

Valores possíveis em `skipped_breakdown`:
- `muted` — pelo menos um canal mutado bloqueou o envio.
- `no_channel` — nenhum canal tinha template + conta.
- `missing_template` — cascata não devolveu template para algum canal.
- `already_ran` — unique violation (tick duplicado).
- `manual_owned` — reconciliação D11 (existe row manual).

## Feature flags

- `AUTOMACAO_SPAWNER_ENABLED=false` → desliga tudo (fase A e B).
- `AUTOMACAO_VIRTUAL_SPAWNER_ENABLED=false` → desliga só fase B.

## Seeds

6 templates globais inseridos via migration `seed_fixed_event_global_templates` (3 email + 3 whatsapp) com `is_system=true, is_active=true, scope='global'`. Protegidos contra delete por trigger.
