## Why

O popover de notificações em [components/notifications/notification-popover.tsx](components/notifications/notification-popover.tsx) mistura tudo numa lista única — menções/comentários de tarefas de processo, chat de processo, mensagens internas, DMs, grupos, lembretes de calendário, CRM. Quando há actividade intensa num processo, as notificações relevantes (p.ex. "mencionado num comentário da tarefa X") ficam diluídas por mensagens sociais e os consultores perdem contexto operacional. Separar em duas abas — **Processo** e **Geral** — torna imediata a distinção entre *trabalho que requer acção* e *ruído social/informativo*.

## What Changes

- Adicionar `Tabs` (shadcn) ao `NotificationPopover` com duas abas: **Processo** e **Geral**. Mantém título, botão "Marcar tudo como lido" e footer actuais.
- Classificar cada notificação em exactamente um bucket a partir de `entity_type` (regra estável, sem nova coluna de DB):
  - **Processo**: `proc_instance`, `proc_task`, `proc_task_comment`, `proc_chat_message`.
  - **Geral**: tudo o resto (`internal_chat_message`, `task`, `task_comment`, CRM/`leads_notifications` normalizadas, `calendar_reminder`, qualquer tipo futuro não reconhecido).
- Cada aba mostra badge com contagem de *não lidas* desse bucket (usar `variant="destructive"` quando > 0, tal como o badge global do sino).
- Aba default ao abrir o popover: **Processo** se tiver não lidas, senão **Geral** se tiver não lidas, senão **Processo**.
- "Marcar tudo como lido" passa a operar **apenas sobre a aba activa** (escopo contextual). A API `PUT /api/notifications` ganha filtro opcional por conjunto de `entity_type`. Isto é uma **mudança de comportamento** do botão, não BREAKING do endpoint (parâmetro é aditivo).
- Empty state específico por aba ("Sem notificações de processo" / "Sem notificações gerais").
- Fora de scope: página `/dashboard/notificacoes` (mantém filtros actuais `all`/`unread` + dropdown de `notification_type`); coluna `source` na tabela `notifications`; reordenação/agrupamento dentro das abas.

## Capabilities

### New Capabilities
- `notifications-popover-tabs`: classificação de notificações em dois buckets (Processo vs Geral) via `entity_type`, UI de abas no popover com contagens de não-lidas por bucket, selecção de aba default baseada em não-lidas, e "marcar tudo como lido" com escopo da aba activa.

### Modified Capabilities
<!-- Nenhuma — não há spec existente para o popover de notificações. -->

## Impact

- **Código alterado:**
  - [components/notifications/notification-popover.tsx](components/notifications/notification-popover.tsx) — adicionar `Tabs`, estado `activeTab`, filtro derivado, empty states por aba, redireccionar "Marcar tudo como lido" para o bucket activo.
  - [app/api/notifications/route.ts](app/api/notifications/route.ts) — `PUT` aceita query/body opcional `entity_types` (`string[]`) para limitar o update a essas entidades.
  - [hooks/use-notifications.ts](hooks/use-notifications.ts) — `markAllAsRead(entityTypes?)` passa o filtro; actualização local respeita o escopo.
  - [lib/notifications/types.ts](lib/notifications/types.ts) — novo helper `classifyBucket(entityType) → 'processo' | 'geral'` e constante `PROCESS_ENTITY_TYPES`.
- **Sem migração de DB.** Sem alteração na shape da resposta da API `GET`.
- **Sem impacto** na página completa `/dashboard/notificacoes`, no `unread-count` do sino, ou nas subscrições realtime.
- **i18n:** novas strings PT-PT: "Processo", "Geral", "Sem notificações de processo", "Sem notificações gerais".
- **Testes manuais:** disparar `comment_mention` em tarefa de processo → cai em Processo; `dm_message` → cai em Geral; "Marcar tudo como lido" na aba Processo não limpa as Gerais.
