# IMPL-AUTO-F1-DESVIOS — Desvios da Spec na Implementação da Fase 1

**Data:** 2026-03-05
**Status:** Implementado com sucesso
**Referência:** SPEC-AUTO-F1-DATABASE.md

---

## Desvio 1: Foreign Keys referenciam `dev_users` em vez de `users`

**Spec original:** Todas as FKs de `user_id`, `created_by` e `changed_by` referenciam `users(id)`

**Implementação:** Alterado para `dev_users(id)`

**Motivo:** A tabela `users` é legacy e está vazia (0 rows). O projecto utiliza `dev_users` como tabela principal de utilizadores, conforme documentado no CLAUDE.md: *"NÃO usar tabelas `users` e `property_listings` — são legacy."*

**Tabelas afectadas:**
- `auto_wpp_instances.user_id` → `dev_users(id)` (spec: `users(id)`)
- `auto_wpp_templates.created_by` → `dev_users(id)` (spec: `users(id)`)
- `auto_flows.created_by` → `dev_users(id)` (spec: `users(id)`)
- `auto_flow_versions.changed_by` → `dev_users(id)` (spec: `users(id)`)

---

## Desvio 2: Migrations divididas em sub-migrations

**Spec original:** Migration 10 contém pgmq queues + Realtime + Functions + Cron tudo junto

**Implementação:** Dividida em 4 migrations separadas:
1. `auto_create_queues_realtime_functions` — criação das filas pgmq
2. `auto_enable_realtime` — ALTER PUBLICATION para Realtime
3. `auto_create_worker_functions` — funções `auto_claim_steps` e `auto_reset_stuck_steps`
4. `auto_schedule_cron_jobs` — agendamento dos cron jobs

**Motivo:** Melhor granularidade e debugging. Se uma parte falhar, as anteriores ficam aplicadas e é mais fácil identificar o problema.

---

## Verificação dos Critérios de Aceitação

| Critério | Resultado |
|----------|-----------|
| Todas as migrations aplicam sem erro | ✅ 15 migrations aplicadas |
| Extensões pgmq, pg_cron, pg_net activas | ✅ pgmq 1.5.1, pg_cron 1.6.4, pg_net 0.19.5 |
| Filas pgmq existem | ✅ `auto_step_queue` + `auto_step_dlq` |
| Realtime habilitado | ✅ `auto_step_runs`, `auto_runs`, `auto_webhook_captures` |
| `tpl_variables` tem 25+ registos | ✅ 27 registos (14 existentes + 13 novos) |
| Versionamento automático | ✅ Testado: update de `flow_definition` cria versão |
| CASCADE funciona | ✅ Testado: delete de flow remove triggers, runs, steps |
| Cron jobs agendados | ✅ `auto-detect-stuck` (*/5 min) + `auto-cleanup` (3h diário) |

---

## Tabelas Criadas (9)

1. `auto_wpp_instances` — Instâncias WhatsApp via Uazapi
2. `auto_wpp_templates` — Templates de mensagens WhatsApp
3. `auto_flows` — Fluxos de automação
4. `auto_triggers` — Gatilhos dos fluxos
5. `auto_runs` — Execuções de fluxos
6. `auto_step_runs` — Execução de cada nó individual
7. `auto_delivery_log` — Log de entregas (WhatsApp, email, notificação)
8. `auto_webhook_captures` — Capturas de webhook para teste
9. `auto_flow_versions` — Versionamento automático de fluxos
