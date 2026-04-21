## Context

O popover em [components/notifications/notification-popover.tsx](components/notifications/notification-popover.tsx) renderiza uma lista plana de notificações obtidas por [hooks/use-notifications.ts](hooks/use-notifications.ts), que por sua vez agrega `/api/notifications` (tabela `notifications`) + `/api/crm/notifications` (tabela `leads_notifications`, normalizada para a mesma shape). Cada `Notification` tem `entity_type` já bem discriminado: `proc_instance`, `proc_task`, `proc_task_comment`, `proc_chat_message`, `internal_chat_message`, `task`, `task_comment`, etc. O sino, contagem global de não lidas e subscrições realtime (Supabase channel sobre `notifications` e `leads_notifications`) não mudam com este change.

A página `/dashboard/notificacoes` já tem filtros (`all`/`unread` + dropdown por `notification_type`) e fica fora de scope — este change é apenas sobre o popover.

## Goals / Non-Goals

**Goals:**
- Classificar determinísticamente cada notificação em **Processo** ou **Geral** com base apenas em `entity_type`, sem depender de `notification_type` (mais estável a tipos novos).
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

### D1. Classificação por `entity_type`, não por `notification_type`

**Decisão:** adicionar um helper puro em [lib/notifications/types.ts](lib/notifications/types.ts):

```ts
export const PROCESS_ENTITY_TYPES = [
  'proc_instance',
  'proc_task',
  'proc_task_comment',
  'proc_chat_message',
] as const

export type NotificationBucket = 'processo' | 'geral'

export function classifyBucket(entityType: EntityType | string | null | undefined): NotificationBucket {
  return PROCESS_ENTITY_TYPES.includes(entityType as any) ? 'processo' : 'geral'
}
```

**Porquê e não alternativas:**
- *Alternativa A: classificar por `notification_type`*. Há 27 tipos (`process_*`, `task_*`, `comment_mention`, `chat_mention`, `dm_message`, etc.) e mais alguns podem surgir. `comment_mention` pode ser de tarefa de processo *ou* de tarefa geral — depende de `entity_type`. Classificar por tipo força manutenção sempre que surja um novo tipo.
- *Alternativa B: nova coluna `source` na DB*. Resolve, mas requer migração, backfill e actualização de todos os call sites de `NotificationService.create`. Sobre-engenharia para um split de UI.
- **Escolhida: `entity_type`**. Já existe, já é preenchido em todos os call sites (inserts em `app/api/processes/[id]/tasks/[taskId]/comments/route.ts:114-147` e `app/api/processes/[id]/chat/route.ts:144-160`), e a lista de `PROCESS_ENTITY_TYPES` é pequena e estável. Qualquer tipo futuro cai no bucket Geral por default — *degradação graciosa*.

### D2. Filtragem client-side (não server-side)

O hook [hooks/use-notifications.ts](hooks/use-notifications.ts) continua a carregar todas as notificações numa única chamada. O popover deriva `processNotifications` / `generalNotifications` com `useMemo` a partir do array unificado.

**Porquê:**
- O popover já paginava client-side (usa `.slice` sobre array em memória).
- A contagem de não-lidas por bucket é calculada no mesmo `useMemo` — zero round-trips adicionais.
- Realtime continua a actualizar *todas* as notificações; a aba actualiza-se sozinha quando chega um evento que pertence ao seu bucket.

**Trade-off:** se o utilizador tiver milhares de notificações por carregar, puxamos tudo. Mas o endpoint `GET /api/notifications` em [app/api/notifications/route.ts:5-67](app/api/notifications/route.ts) já pagina (default limit 50) — a UI do popover só mostra as primeiras N. Sem mudança de comportamento.

### D3. "Marcar tudo como lido" com escopo de aba

**Contrato da API (aditivo, não-breaking):**

`PUT /api/notifications` passa a aceitar body opcional `{ entity_types?: string[] }`. Se presente, o `UPDATE` adiciona `.in('entity_type', entity_types)` ao filtro existente `.eq('recipient_id', userId).eq('is_read', false)`. Se ausente, comportamento idêntico ao actual (marca tudo).

**No hook:** `markAllAsRead(entityTypes?: readonly string[])` — assinatura aditiva, default undefined. Optimistic update local aplica o mesmo filtro.

**CRM (`leads_notifications`):** o bucket Processo só inclui `proc_*`, portanto CRM nunca está na aba Processo. Quando a aba activa é Processo, **não tocamos** em `/api/crm/notifications`. Quando é Geral, chamamos `markAllAsRead` para `/api/crm/notifications` **e** `PUT /api/notifications` com `entity_types` = complemento dos `PROCESS_ENTITY_TYPES` (ou mais simples: flag `exclude_entity_types` — ver *D3a*).

**D3a — exclude vs include:** mais limpo adicionar **ambos** os modos? Não. Para a aba Geral precisamos de "tudo excepto Processo". Duas opções:

- (i) enumerar todos os `entity_type` Geral conhecidos e passar em `entity_types` — frágil (tipos novos ficam de fora).
- (ii) adicionar `exclude_entity_types?: string[]` — flexível e futura-prova.

**Escolhida:** (ii). API aceita **um dos dois** (não ambos simultaneamente — 400 se ambos presentes). Aba Processo → `entity_types: PROCESS_ENTITY_TYPES`. Aba Geral → `exclude_entity_types: PROCESS_ENTITY_TYPES`.

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

- **[Risk]** Uma notificação pode chegar com `entity_type` novo/inesperado → cai silenciosamente em Geral. **Mitigação:** comportamento desejado (fail-open para Geral). Tipos novos de processo devem ser adicionados a `PROCESS_ENTITY_TYPES`; adicionar teste unitário sobre `classifyBucket` com cada valor actualmente emitido.
- **[Risk]** "Marcar tudo como lido" na aba Processo pode parecer que limpou tudo se o utilizador tiver sempre a aba Processo aberta e não olhar para Geral. **Mitigação:** badge na aba Geral permanece visível com o contador de não-lidas — sinal claro de que há mais.
- **[Risk]** O helper `classifyBucket` e a API de exclude/include ficam dessincronizados (novo tipo de processo adicionado ao helper mas não reflectido na UI). **Mitigação:** usar a mesma constante `PROCESS_ENTITY_TYPES` nos dois sítios (popover → `useMemo` usa o helper; hook → passa a constante directamente ao endpoint).
- **[Trade-off]** Não persistimos aba seleccionada → utilizador pode achar que o popover "muda sozinho". Aceitável: o default é útil (leva onde há trabalho), e o custo de mudar de aba é um clique.
- **[Trade-off]** Não filtramos server-side → puxamos notificações geral + processo numa só chamada. Já é o comportamento actual; não regride.

## Migration Plan

Não há migração de DB. Rollout em passos atómicos:

1. Deploy do helper `classifyBucket` + constante `PROCESS_ENTITY_TYPES` em [lib/notifications/types.ts](lib/notifications/types.ts).
2. Deploy do endpoint `PUT /api/notifications` com suporte a `entity_types` / `exclude_entity_types` (aditivo; clientes antigos continuam a funcionar).
3. Deploy do hook + popover com tabs.

**Rollback:** reverter (3) restaura o popover plano; (1) e (2) ficam no código sem utilizadores (inócuo).

## Open Questions

Nenhuma bloqueante. Decisões tomadas:
- Default = Processo se tiver não-lidas, senão Geral se tiver, senão Processo (D4).
- Sem persistência de aba activa entre aberturas (D4).
- Sem mudança no badge global do sino (mantém total agregado).
