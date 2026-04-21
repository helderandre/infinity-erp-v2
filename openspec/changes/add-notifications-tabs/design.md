## Context

O popover em [components/notifications/notification-popover.tsx](components/notifications/notification-popover.tsx) renderiza uma lista plana de notificações obtidas por [hooks/use-notifications.ts](hooks/use-notifications.ts), que por sua vez agrega `/api/notifications` (tabela `notifications`) + `/api/crm/notifications` (tabela `leads_notifications`, normalizada para a mesma shape). Cada `Notification` tem `entity_type` já bem discriminado: `proc_instance`, `proc_task`, `proc_task_comment`, `proc_chat_message`, `internal_chat_message`, `task`, `task_comment`, etc. O sino, contagem global de não lidas e subscrições realtime (Supabase channel sobre `notifications` e `leads_notifications`) não mudam com este change.

A página `/dashboard/notificacoes` já tem filtros (`all`/`unread` + dropdown por `notification_type`) e fica fora de scope — este change é apenas sobre o popover.

## Goals / Non-Goals

**Goals:**
- Classificar determinísticamente cada notificação em **Processo** ou **Geral** com base em `notification_type` com uma lista estreita de 4 valores conversacionais (ver D1).
- Duas abas no popover com contagem de não-lidas por bucket; aba default escolhida pela presença de não-lidas (Processo > Geral > Processo).
- "Marcar tudo como lido" passa a operar apenas sobre a aba activa.
- Zero mudanças de DB, zero migrações, zero impacto nas subscrições realtime.

**Non-Goals:**
- Adicionar coluna `source`/`category` em `notifications`.
- Reformular a página `/dashboard/notificacoes` (fica como está).
- Mudar o badge global do sino (continua a mostrar total de não-lidas, não por bucket).
- Reordenar/agrupar notificações dentro de cada aba (mantém order-by `created_at DESC`).
- Alterar a estrutura da shape `Notification` em [lib/notifications/types.ts](lib/notifications/types.ts).

## Decisions

### D1. Classificação por `notification_type` (lista estreita de "menções + chat")

> **Revisto após feedback de UAT** (v2). A decisão original foi classificar por `entity_type`, mas isso colocava em Processo tudo o que referenciasse uma entidade `proc_*` — incluindo `calendar_reminder` (que é emitido com `entity_type: 'proc_instance'` em [app/api/cron/calendar-reminders/route.ts:180](app/api/cron/calendar-reminders/route.ts#L180)), `task_assigned`, alertas (`alert_on_*`, emitidos pelo [lib/alerts/service.ts](lib/alerts/service.ts) com `entity_type: 'proc_task'`), etc. O utilizador explicitou que a aba Processo só deve conter "menções do processo e chat do processo". A classificação por `entity_type` era demasiado abrangente.

**Decisão revista:** classificar por `notification_type` com uma lista estreita e explícita das interacções conversacionais:

```ts
export const PROCESS_NOTIFICATION_TYPES = [
  'comment_mention',   // @-mention num comentário de tarefa de processo
  'chat_mention',      // @-mention no chat de processo
  'chat_message',      // nova mensagem no chat de processo
  'task_comment',      // novo comentário na tarefa atribuída ao utilizador
] as const

export function classifyBucket(notificationType: string | null | undefined): NotificationBucket {
  return PROCESS_NOTIFICATION_TYPES.includes(notificationType as ProcessNotificationType)
    ? 'processo'
    : 'geral'
}
```

**Porquê e não alternativas:**
- *Alternativa A (original): classificar por `entity_type`*. **Rejeitada** — falha com `calendar_reminder`/`task_assigned`/alertas que referenciam entidades de processo mas não são conversação.
- *Alternativa B: nova coluna `source` na DB*. Continua sobre-engenharia — não precisamos de persistir uma classificação que é puramente de apresentação.
- *Alternativa C: híbrido `notification_type` AND `entity_type ∈ proc_*`*. Redundante — os 4 tipos acima são emitidos exclusivamente a partir de processos ([app/api/processes/[id]/tasks/[taskId]/comments/route.ts:107-150](app/api/processes/[id]/tasks/[taskId]/comments/route.ts#L107-L150), [app/api/processes/[id]/chat/route.ts:140-164](app/api/processes/[id]/chat/route.ts#L140-L164)). Adicionar o `entity_type` check só cria um nó-e de manutenção dupla.
- **Escolhida: `notification_type` estreito**. Ganhos: (1) match literal ao pedido do utilizador ("menções do processo, chat do processo"); (2) tipos não-conversacionais (`calendar_reminder`, `task_assigned`, alertas) caem correctamente em Geral; (3) tipos novos caem em Geral por default — degradação graciosa; (4) lista de 4 itens é mais pequena/estável que antes.

### D2. Filtragem client-side (não server-side)

O hook [hooks/use-notifications.ts](hooks/use-notifications.ts) continua a carregar todas as notificações numa única chamada. O popover deriva `processNotifications` / `generalNotifications` com `useMemo` a partir do array unificado.

**Porquê:**
- O popover já paginava client-side (usa `.slice` sobre array em memória).
- A contagem de não-lidas por bucket é calculada no mesmo `useMemo` — zero round-trips adicionais.
- Realtime continua a actualizar *todas* as notificações; a aba actualiza-se sozinha quando chega um evento que pertence ao seu bucket.

**Trade-off:** se o utilizador tiver milhares de notificações por carregar, puxamos tudo. Mas o endpoint `GET /api/notifications` em [app/api/notifications/route.ts:5-67](app/api/notifications/route.ts) já pagina (default limit 50) — a UI do popover só mostra as primeiras N. Sem mudança de comportamento.

### D3. "Marcar tudo como lido" com escopo de aba

**Contrato da API (aditivo, não-breaking):**

`PUT /api/notifications` passa a aceitar body opcional `{ notification_types?: string[] }` ou `{ exclude_notification_types?: string[] }` (mutuamente exclusivos — 400 se ambos). Se presente, o `UPDATE` adiciona `.in('notification_type', list)` / `.not('notification_type','in','(...)')` ao filtro existente `.eq('recipient_id', userId).eq('is_read', false)`. Se ausente, comportamento idêntico ao actual (marca tudo).

**No hook:** `markAllAsRead(options?: { scope?: NotificationBucket })` — assinatura aditiva. Optimistic update local aplica o mesmo filtro via `classifyBucket(n.notification_type) === scope`.

**CRM (`leads_notifications`):** nenhum dos `PROCESS_NOTIFICATION_TYPES` é emitido a partir do normalizer CRM ([hooks/use-notifications.ts:23-39](hooks/use-notifications.ts#L23-L39)) — os `notification_type` CRM vêm do backend CRM (p.ex. `lead_assigned`, `lead_status_changed`) e caem sempre em Geral. Quando a aba activa é Processo, **não tocamos** em `/api/crm/notifications`. Quando é Geral, chamamos `PUT /api/crm/notifications { all: true }` **e** `PUT /api/notifications` com `exclude_notification_types: PROCESS_NOTIFICATION_TYPES`.

**D3a — exclude vs include:** mantido tal como antes — aceitar **um dos dois** (não ambos simultaneamente — 400 se ambos presentes). Aba Processo → `notification_types: PROCESS_NOTIFICATION_TYPES`. Aba Geral → `exclude_notification_types: PROCESS_NOTIFICATION_TYPES`.

### D4. Aba default ao abrir

Estado inicial calculado em `useEffect` quando o popover abre (observar `open` do Popover):

```
if (processUnread > 0) → 'processo'
else if (generalUnread > 0) → 'geral'
else → 'processo'
```

Não persistir em localStorage — é barato recalcular e a intenção é levar o utilizador para onde há trabalho pendente.

### D5. Badges por aba

Reutilizar o componente `Badge` do shadcn. Quando `unread > 0` para a aba, mostrar `<Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{unread}</Badge>` alinhado à direita no `TabsTrigger`. Formato idêntico ao badge do sino em [components/notifications/notification-popover.tsx:40](components/notifications/notification-popover.tsx#L40) (`99+` para >99).

## Risks / Trade-offs

- **[Risk]** Uma notificação pode chegar com `notification_type` novo/inesperado → cai silenciosamente em Geral. **Mitigação:** comportamento desejado (fail-open para Geral). Tipos novos de conversação em processo devem ser explicitamente adicionados a `PROCESS_NOTIFICATION_TYPES`.
- **[Risk]** "Marcar tudo como lido" na aba Processo pode parecer que limpou tudo se o utilizador tiver sempre a aba Processo aberta e não olhar para Geral. **Mitigação:** badge na aba Geral permanece visível com o contador de não-lidas — sinal claro de que há mais.
- **[Risk]** O helper `classifyBucket` e a API de exclude/include ficam dessincronizados (novo tipo adicionado ao helper mas não reflectido na UI). **Mitigação:** usar a mesma constante `PROCESS_NOTIFICATION_TYPES` nos dois sítios (popover → `useMemo` usa o helper; hook → passa a constante directamente ao endpoint).
- **[Trade-off]** Não persistimos aba seleccionada → utilizador pode achar que o popover "muda sozinho". Aceitável: o default é útil (leva onde há trabalho), e o custo de mudar de aba é um clique.
- **[Trade-off]** Não filtramos server-side → puxamos notificações geral + processo numa só chamada. Já é o comportamento actual; não regride.

## Migration Plan

Não há migração de DB. Rollout em passos atómicos:

1. Deploy do helper `classifyBucket` + constante `PROCESS_NOTIFICATION_TYPES` em [lib/notifications/types.ts](lib/notifications/types.ts).
2. Deploy do endpoint `PUT /api/notifications` com suporte a `notification_types` / `exclude_notification_types` (aditivo; clientes antigos continuam a funcionar).
3. Deploy do hook + popover com tabs.

**Rollback:** reverter (3) restaura o popover plano; (1) e (2) ficam no código sem utilizadores (inócuo).

## Open Questions

Nenhuma bloqueante. Decisões tomadas:
- Default = Processo se tiver não-lidas, senão Geral se tiver, senão Processo (D4).
- Sem persistência de aba activa entre aberturas (D4).
- Sem mudança no badge global do sino (mantém total agregado).
